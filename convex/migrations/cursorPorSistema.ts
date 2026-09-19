import { Migrations } from '@convex-dev/migrations';
import { components, internal } from '../_generated/api';
import type { DataModel, Doc, Id } from '../_generated/dataModel';
import { internalQuery, type QueryCtx } from '../_generated/server';
import { repoRefOf, syncedThroughOf } from '../githubData';
import { GITHUB_SOURCE } from '../../src/features/github-sync/github-sync.types';

// ════════════════════════════════════════════════════════════════════════════
// El cursor del refresco de GitHub, del sistema y no de la cuenta
// ════════════════════════════════════════════════════════════════════════════
//
// `syncConnections` es una fila por usuario, así que el cursor incremental que
// guardaba (`syncedThrough`) lo compartían todos los sistemas de esa persona:
// el segundo sistema enlazado a otro repositorio arrancaba desde donde llegó el
// primero y sus issues viejos no entraban en ningún refresco. El cursor pasa a
// `systems.metadata.github.syncedThrough`, al lado del repositorio que lo
// produjo.
//
// ── Qué toca, campo por campo ──────────────────────────────────────────────
//
//   systems.metadata.github.syncedThrough
//       ← `syncConnections.syncedThrough` de la conexión de GitHub de su dueño,
//         y sólo cuando esa persona tiene **exactamente un** sistema con
//         repositorio enlazado. Con uno solo, el cursor de la cuenta era el de
//         ese sistema sin ambigüedad.
//
// Con dos o más sistemas enlazados no hay dato que diga cuál produjo el cursor,
// así que ninguno lo recibe: se quedan sin cursor y su siguiente refresco pide
// el repositorio entero. Es una sincronización más cara una vez, y es
// idempotente (`applySync` no duplica tarjetas y no pisa lo que Kino añadió),
// contra la alternativa de repartir un cursor inventado y dejar issues fuera
// para siempre, que es justo lo que esta migración viene a arreglar.
//
// ── Lo que NO toca ─────────────────────────────────────────────────────────
// `syncConnections.syncedThrough` se queda escrito donde está. Quitarlo es un
// cambio de schema, que es el otro deploy del expand y contract: hasta
// entonces el campo queda muerto y nadie lo lee.
//
// ── Idempotencia ───────────────────────────────────────────────────────────
// Un sistema que ya tiene cursor no se toca, y uno sin repositorio tampoco. La
// segunda pasada no escribe ningún documento.
//
// ── Cómo se corre ──────────────────────────────────────────────────────────
//   npx convex run migrations/cursorPorSistema:pendientes   # cuántos esperan cursor
//   npx convex run migrations/cursorPorSistema:run
//   npx convex run migrations/cursorPorSistema:pendientes   # tiene que dar cero
//
// Contra producción, con el respaldo del día en verde delante, y con `--prod`.

export const migrations = new Migrations<DataModel>(components.migrations);

/** El cursor que guardaba la conexión de GitHub de esa persona, si guardaba alguno. */
async function cursorDeLaCuenta(ctx: QueryCtx, userId: Id<'users'>): Promise<number | undefined> {
  const fila = await ctx.db
    .query('syncConnections')
    .withIndex('by_user_provider', (q) => q.eq('userId', userId).eq('provider', GITHUB_SOURCE))
    .unique();
  return fila?.syncedThrough;
}

/**
 * Los sistemas de esa persona que miran un repositorio. Lee por `by_user_active`
 * con el usuario fijado: el rango es lo que una cuenta tiene, que es decenas de
 * documentos, y se recorre una vez por sistema enlazado durante la migración.
 */
async function sistemasEnlazados(ctx: QueryCtx, userId: Id<'users'>): Promise<number> {
  const sistemas = await ctx.db
    .query('systems')
    .withIndex('by_user_active', (q) => q.eq('userId', userId))
    .collect();
  return sistemas.filter((sistema) => repoRefOf(sistema) !== null).length;
}

/**
 * El parche que un sistema necesita, o `undefined` si no le toca nada. Fuera de
 * `migrateOne` para poder probarlo sin montar el componente.
 */
export async function cursorDelSistema(ctx: QueryCtx, doc: Doc<'systems'>): Promise<{ metadata: Record<string, unknown> } | undefined> {
  const repo = repoRefOf(doc);
  if (!repo) return undefined;
  if (syncedThroughOf(doc) !== null) return undefined;

  const cursor = await cursorDeLaCuenta(ctx, doc.userId);
  if (cursor === undefined) return undefined;
  if ((await sistemasEnlazados(ctx, doc.userId)) !== 1) return undefined;

  return { metadata: { ...(doc.metadata ?? {}), github: { ...repo, syncedThrough: cursor } } };
}

export const cursores = migrations.define({
  table: 'systems',
  migrateOne: cursorDelSistema,
});

export const run = migrations.runner([internal.migrations.cursorPorSistema.cursores]);

/**
 * Cuántos sistemas enlazados siguen sin cursor, y cuántos de ellos lo van a
 * recibir. La diferencia son los de las cuentas con dos o más repositorios, que
 * se quedan sin él a propósito y refrescan entero la próxima vez.
 *
 * Lee las dos tablas enteras: es una lectura de herramienta, a mano y una vez,
 * no una suscripción ni un cron.
 */
export const pendientes = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sistemas = (await ctx.db.query('systems').collect()).filter((sistema) => repoRefOf(sistema) !== null);
    const sinCursor = sistemas.filter((sistema) => syncedThroughOf(sistema) === null);
    const conCursorHeredable: Doc<'systems'>[] = [];
    for (const sistema of sinCursor) {
      if ((await cursorDelSistema(ctx, sistema)) !== undefined) conCursorHeredable.push(sistema);
    }
    return {
      enlazados: sistemas.length,
      sinCursor: sinCursor.length,
      heredan: conCursorHeredable.length,
      refrescanEntero: sinCursor.length - conCursorHeredable.length,
    };
  },
});
