import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import {
  INTENSIDAD_POR_DEFECTO,
  RESUMEN_POR_DEFECTO,
  SILENCIO_POR_DEFECTO,
  proximoAviso,
  proximoResumen,
  type Preferencias,
} from './recordatorios';

// El puente entre el calendario puro de `recordatorios.ts` y la base: leer las
// preferencias de una persona y dejar escrito en cada tarea cuándo le toca su
// próximo aviso. El cron sólo lee `tasks.nextReminderAt` por índice, así que
// **toda escritura que cambie la fecha, el estado o la intensidad de una tarea
// pasa por `recalcularAviso`**. Si alguna se olvida, el resumen de la mañana
// la repara al día siguiente (`notifications.registrar`).

export interface AjustesDeAviso extends Preferencias {
  activos: boolean;
  resumen: string;
  correo: boolean;
}

export async function ajustesDeAviso(ctx: QueryCtx | MutationCtx, user: Doc<'users'>): Promise<AjustesDeAviso> {
  const row = await ctx.db
    .query('userSettings')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .unique();
  return deFila(user, row);
}

export function deFila(user: Doc<'users'>, row: Doc<'userSettings'> | null): AjustesDeAviso {
  return {
    tz: user.timezone,
    intensidad: row?.reminderIntensity ?? INTENSIDAD_POR_DEFECTO,
    silencioDesde: row?.quietHoursStart ?? SILENCIO_POR_DEFECTO.desde,
    silencioHasta: row?.quietHoursEnd ?? SILENCIO_POR_DEFECTO.hasta,
    activos: row?.notificationsEnabled ?? true,
    resumen: row?.morningDigestTime ?? RESUMEN_POR_DEFECTO,
    correo: row?.emailReminders ?? true,
  };
}

/** ¿Le queda algo que avisar a esta tarea? Terminada, borrada o sin fecha, no. */
export function avisable(task: Doc<'tasks'>): task is Doc<'tasks'> & { dueDate: number } {
  return task.dueDate !== undefined && task.deletedAt === undefined && task.status !== 'done' && task.completedAt === undefined;
}

/** El próximo aviso de una tarea después de `despues`, o `undefined`. */
export function calcularAviso(task: Doc<'tasks'>, ajustes: AjustesDeAviso, despues: number): number | undefined {
  if (!ajustes.activos || !avisable(task)) return undefined;
  return proximoAviso({ dueDate: task.dueDate, intensidad: task.reminderIntensity }, ajustes, despues) ?? undefined;
}

/**
 * Deja escrito el próximo aviso de una tarea. Sólo escribe si cambia, para no
 * despertar las suscripciones que miran la tarea por nada.
 */
export async function recalcularAviso(
  ctx: MutationCtx,
  task: Doc<'tasks'>,
  ajustes?: AjustesDeAviso,
  despues = Date.now(),
): Promise<void> {
  let prefs = ajustes;
  if (!prefs) {
    const user = await ctx.db.get(task.userId);
    if (!user) return;
    prefs = await ajustesDeAviso(ctx, user);
  }
  const siguiente = calcularAviso(task, prefs, despues);
  if (siguiente !== task.nextReminderAt) await ctx.db.patch(task._id, { nextReminderAt: siguiente });
}

/**
 * Tope de tareas que se recalculan al cambiar un ajuste. Lee las tareas vivas
 * con fecha de una persona por `by_user_alive_due`: el rango lo fija sólo el
 * usuario, y el motivo de no acotarlo más es que cambiar la zona, el silencio o
 * la intensidad mueve los avisos de todas. Es una escritura de ajustes, no algo
 * que corra solo; el tope evita que una cuenta enorme pase de los diez
 * segundos, y lo que quede fuera lo repara el resumen de la mañana.
 */
const RECALCULO_TOPE = 2_000;

export async function recalcularAvisosDe(ctx: MutationCtx, userId: Id<'users'>): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) return;
  const ajustes = await ajustesDeAviso(ctx, user);
  const now = Date.now();
  const tareas = await ctx.db
    .query('tasks')
    .withIndex('by_user_alive_due', (q) => q.eq('userId', userId).eq('deletedAt', undefined).gte('dueDate', 0))
    .take(RECALCULO_TOPE);
  for (const task of tareas) await recalcularAviso(ctx, task, ajustes, now);
}

/** Deja programado el próximo resumen de la mañana en la fila de ajustes. */
export async function programarResumen(ctx: MutationCtx, userId: Id<'users'>, despues = Date.now()): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) return;
  const row = await ctx.db
    .query('userSettings')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  if (!row) return;
  const ajustes = deFila(user, row);
  const siguiente = ajustes.activos ? proximoResumen(ajustes.tz, ajustes.resumen, despues) : undefined;
  if (siguiente !== row.nextDigestAt) await ctx.db.patch(row._id, { nextDigestAt: siguiente });
}
