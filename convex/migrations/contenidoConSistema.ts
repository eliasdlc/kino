import { Migrations } from '@convex-dev/migrations';
import { components, internal } from '../_generated/api';
import type { DataModel, Doc, Id } from '../_generated/dataModel';
import { internalQuery, type MutationCtx, type QueryCtx } from '../_generated/server';

// ════════════════════════════════════════════════════════════════════════════
// Contenido con sistema: el expand
// ════════════════════════════════════════════════════════════════════════════
//
// Todo contenido (carpeta, página, nota adhesiva, versión de un capítulo) va a
// pertenecer a un sistema de forma obligatoria: en otro deploy, `systemId` deja
// de ser opcional en las cuatro tablas. Ese deploy se rechaza si queda un solo
// documento sin sistema, así que esta migración rellena los que faltan antes.
//
// Hoy todo escritor ya lo escribe: `pages.create` y `folders.create` lo exigen,
// una nota lo hereda de su página o su carpeta, y una versión de su página. Lo
// que queda son documentos de antes de esas reglas.
//
// ── Qué toca, documento por documento ──────────────────────────────────────
//
//   folders.systemId        ← el de su carpeta madre; sin madre, la Bandeja de
//                             su dueño.
//   pages.systemId          ← el de su carpeta; sin carpeta, el de su página
//                             madre; sin ninguna, la Bandeja de su dueño.
//   stickyNotes.systemId    ← el de su página o su carpeta, que a esta altura
//                             ya lo tienen.
//   pageSnapshots.systemId  ← el de su página.
//
// El orden importa y el runner lo fija: carpetas, páginas, notas, versiones.
// Una nota que cuelga de una página huérfana se rellena en la misma corrida
// porque su página se rellenó dos pasos antes.
//
// La Bandeja es el sistema que toda cuenta tiene desde `systems.setup`, y es
// donde ya cae lo que no dice a dónde va. Una cuenta sin Bandeja (registro sin
// terminar) deja sus documentos como están y `pendientes` los cuenta: son los
// que impiden el contract, y se resuelven a mano, no adivinando.
//
// ── Idempotencia ───────────────────────────────────────────────────────────
// Un documento con `systemId` no se toca. La segunda pasada no escribe nada.
//
// ── Cómo se corre ──────────────────────────────────────────────────────────
//   npx convex run migrations/contenidoConSistema:pendientes   # cuántos faltan, por tabla
//   npx convex run migrations/contenidoConSistema:run          # las cuatro, en orden
//   npx convex run migrations/contenidoConSistema:pendientes   # tiene que dar cero
//
// Contra producción, con el respaldo del día en verde delante, y con `--prod`.

export const migrations = new Migrations<DataModel>(components.migrations);

/** La Bandeja de una persona, o `undefined` si la cuenta no llegó a `systems.setup`. */
async function bandejaDe(ctx: QueryCtx, userId: Id<'users'>): Promise<Id<'systems'> | undefined> {
  const inbox = await ctx.db
    .query('systems')
    .withIndex('by_user_inbox', (q) => q.eq('userId', userId).eq('isInbox', true))
    .first();
  return inbox?._id;
}

/** A qué sistema pertenece una carpeta sin sistema: el de su madre, o la Bandeja. */
export async function sistemaDeCarpeta(ctx: QueryCtx, doc: Doc<'folders'>): Promise<Id<'systems'> | undefined> {
  if (doc.systemId) return doc.systemId;
  const parent = doc.parentId ? await ctx.db.get(doc.parentId) : null;
  if (parent?.systemId) return parent.systemId;
  return bandejaDe(ctx, doc.userId);
}

/** A qué sistema pertenece una página sin sistema: su carpeta, su madre, o la Bandeja. */
export async function sistemaDePagina(ctx: QueryCtx, doc: Doc<'pages'>): Promise<Id<'systems'> | undefined> {
  if (doc.systemId) return doc.systemId;
  const folder = doc.folderId ? await ctx.db.get(doc.folderId) : null;
  if (folder?.systemId) return folder.systemId;
  const parent = doc.parentPageId ? await ctx.db.get(doc.parentPageId) : null;
  if (parent?.systemId) return parent.systemId;
  return bandejaDe(ctx, doc.userId);
}

/** El sistema de una nota sale de la página o la carpeta donde vive. */
export async function sistemaDeNota(ctx: QueryCtx, doc: Doc<'stickyNotes'>): Promise<Id<'systems'> | undefined> {
  if (doc.systemId) return doc.systemId;
  const owner = doc.pageId ? await ctx.db.get(doc.pageId) : doc.folderId ? await ctx.db.get(doc.folderId) : null;
  return owner?.systemId;
}

/** El sistema de una versión es el de su página. */
export async function sistemaDeVersion(ctx: QueryCtx, doc: Doc<'pageSnapshots'>): Promise<Id<'systems'> | undefined> {
  if (doc.systemId) return doc.systemId;
  const page = await ctx.db.get(doc.pageId);
  return page?.systemId;
}

/** El parche de un documento, o `undefined` si ya tiene sistema o no hay de dónde sacarlo. */
async function parche<T extends { systemId?: Id<'systems'> }>(
  doc: T,
  resolver: () => Promise<Id<'systems'> | undefined>,
): Promise<{ systemId: Id<'systems'> } | undefined> {
  if (doc.systemId !== undefined) return undefined;
  const systemId = await resolver();
  return systemId ? { systemId } : undefined;
}

export const carpetas = migrations.define({
  table: 'folders',
  migrateOne: (ctx: MutationCtx, doc) => parche(doc, () => sistemaDeCarpeta(ctx, doc)),
});

export const paginas = migrations.define({
  table: 'pages',
  migrateOne: (ctx: MutationCtx, doc) => parche(doc, () => sistemaDePagina(ctx, doc)),
});

export const notas = migrations.define({
  table: 'stickyNotes',
  migrateOne: (ctx: MutationCtx, doc) => parche(doc, () => sistemaDeNota(ctx, doc)),
});

export const versiones = migrations.define({
  table: 'pageSnapshots',
  migrateOne: (ctx: MutationCtx, doc) => parche(doc, () => sistemaDeVersion(ctx, doc)),
});

/** Las cuatro en el orden en que dependen unas de otras. */
export const run = migrations.runner([
  internal.migrations.contenidoConSistema.carpetas,
  internal.migrations.contenidoConSistema.paginas,
  internal.migrations.contenidoConSistema.notas,
  internal.migrations.contenidoConSistema.versiones,
]);

/**
 * Cuántos documentos siguen sin sistema, por tabla. Es la cifra que tiene que
 * dar cero antes del deploy que vuelve el campo obligatorio.
 *
 * Carpetas y páginas salen por el índice `by_system` con `systemId` ausente.
 * Notas y versiones no tienen ese índice y se leen enteras: es una lectura de
 * herramienta, una vez y a mano, no una suscripción ni un cron.
 */
export const pendientes = internalQuery({
  args: {},
  handler: async (ctx) => {
    const folders = await ctx.db.query('folders').withIndex('by_system', (q) => q.eq('systemId', undefined)).collect();
    const pages = await ctx.db.query('pages').withIndex('by_system', (q) => q.eq('systemId', undefined)).collect();
    const stickyNotes = (await ctx.db.query('stickyNotes').collect()).filter((doc) => doc.systemId === undefined);
    const pageSnapshots = (await ctx.db.query('pageSnapshots').collect()).filter((doc) => doc.systemId === undefined);
    return {
      folders: folders.length,
      pages: pages.length,
      stickyNotes: stickyNotes.length,
      pageSnapshots: pageSnapshots.length,
      total: folders.length + pages.length + stickyNotes.length + pageSnapshots.length,
    };
  },
});
