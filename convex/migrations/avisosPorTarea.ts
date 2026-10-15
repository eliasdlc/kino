import { Migrations } from '@convex-dev/migrations';
import { components, internal } from '../_generated/api';
import type { DataModel, Doc } from '../_generated/dataModel';
import { internalQuery, type QueryCtx } from '../_generated/server';
import { avisable, calcularAviso, deFila } from '../lib/avisos';
import { proximoResumen } from '../lib/recordatorios';

// ════════════════════════════════════════════════════════════════════════════
// El próximo aviso escrito en cada tarea, y el próximo resumen en cada cuenta
// ════════════════════════════════════════════════════════════════════════════
//
// El cron de recordatorios deja de recorrer las tareas de cada persona y pasa
// a leer sólo las que ya tienen un aviso vencido, por `tasks.by_nextReminder`,
// y sólo las cuentas a las que ya les toca el resumen de la mañana, por
// `userSettings.by_nextDigest`. Lo que ya existía no tiene ninguno de los dos
// campos escrito, y sin esta migración no avisaría hasta que alguien lo tocara.
//
// ── Qué toca, campo por campo ──────────────────────────────────────────────
//
//   tasks.nextReminderAt
//       ← `proximoAviso` (`lib/recordatorios.ts`) desde ahora, con la zona de
//         su dueño y sus ajustes (o los valores por defecto: agresivos, silencio
//         de 22:00 a 07:00). Sólo para tareas vivas, sin terminar y con fecha.
//         Las vencidas de hace tiempo reciben su próxima insistencia.
//
//   userSettings.nextDigestAt
//       ← el próximo `morningDigestTime` local (08:00 por defecto) después de
//         ahora, si los avisos de la cuenta están encendidos.
//
// ── Lo que NO toca ─────────────────────────────────────────────────────────
// `notifiedBeforeDay`, `notifiedDueDay` y los recordatorios automáticos a días
// vista que ya existían. Los primeros quedan muertos hasta el contract; los
// segundos saldrán a su hora una última vez y no se siembran más.
//
// ── Idempotencia ───────────────────────────────────────────────────────────
// Una tarea o una fila que ya tiene su campo escrito no se toca: lo escribió
// una mutación del código nuevo, que sabe más que esta migración. La segunda
// pasada no escribe ningún documento.
//
// ── Cómo se corre ──────────────────────────────────────────────────────────
//   npx convex run migrations/avisosPorTarea:pendientes   # cuántas esperan
//   npx convex run migrations/avisosPorTarea:run
//   npx convex run migrations/avisosPorTarea:pendientes   # tiene que dar cero
//
// Contra producción, con el respaldo del día en verde delante, y con `--prod`.

export const migrations = new Migrations<DataModel>(components.migrations);

async function ajustesDelDueno(ctx: QueryCtx, userId: Doc<'users'>['_id']) {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  const fila = await ctx.db
    .query('userSettings')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  return deFila(user, fila);
}

/** El parche de una tarea, o `undefined` si no le toca nada. */
export async function avisoDeTarea(ctx: QueryCtx, doc: Doc<'tasks'>): Promise<{ nextReminderAt: number } | undefined> {
  if (doc.nextReminderAt !== undefined || !avisable(doc)) return undefined;
  const ajustes = await ajustesDelDueno(ctx, doc.userId);
  if (!ajustes) return undefined;
  const siguiente = calcularAviso(doc, ajustes, Date.now());
  return siguiente === undefined ? undefined : { nextReminderAt: siguiente };
}

/** El parche de una fila de ajustes, o `undefined` si no le toca nada. */
export async function resumenDeCuenta(ctx: QueryCtx, doc: Doc<'userSettings'>): Promise<{ nextDigestAt: number } | undefined> {
  if (doc.nextDigestAt !== undefined) return undefined;
  const user = await ctx.db.get(doc.userId);
  if (!user) return undefined;
  const ajustes = deFila(user, doc);
  if (!ajustes.activos) return undefined;
  return { nextDigestAt: proximoResumen(ajustes.tz, ajustes.resumen, Date.now()) };
}

export const tareas = migrations.define({ table: 'tasks', migrateOne: avisoDeTarea });
export const cuentas = migrations.define({ table: 'userSettings', migrateOne: resumenDeCuenta });

export const run = migrations.runner([internal.migrations.avisosPorTarea.tareas, internal.migrations.avisosPorTarea.cuentas]);

/**
 * Cuántas tareas y cuentas siguen sin su campo. Lee las dos tablas enteras: es
 * una lectura de herramienta, a mano y una vez, no una suscripción ni un cron.
 */
export const pendientes = internalQuery({
  args: {},
  handler: async (ctx) => {
    let tareasPendientes = 0;
    for (const tarea of await ctx.db.query('tasks').collect()) {
      if ((await avisoDeTarea(ctx, tarea)) !== undefined) tareasPendientes += 1;
    }
    let cuentasPendientes = 0;
    for (const fila of await ctx.db.query('userSettings').collect()) {
      if ((await resumenDeCuenta(ctx, fila)) !== undefined) cuentasPendientes += 1;
    }
    return { tareas: tareasPendientes, cuentas: cuentasPendientes };
  },
});
