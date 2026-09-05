import { v } from 'convex/values';
import type { ActionCtx } from './_generated/server';
import { internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { CRON_JOB_NAMES, findStaleCrons, isCronJobName, type CronJobName, type StaleCron } from './lib/cronHealth';

// La bitácora de las tareas programadas. Escribir una fila por ejecución es lo
// que convierte "no ha corrido" de una ausencia de evidencia en una evidencia
// de la ausencia: un cron que deja de dispararse se distingue de uno que corre
// y no tiene nada que hacer.
//
// Todo lo de aquí falla abierto: si la bitácora no se puede escribir, el cron
// hace su trabajo igual. Un registro de vigilancia que tumba lo que vigila es
// peor que no tenerlo.

const RETENTION_MS = 30 * 86_400_000;

const cronJob = v.union(...CRON_JOB_NAMES.map((name) => v.literal(name)));

export const open = internalMutation({
  args: { job: cronJob },
  returns: v.id('cronRuns'),
  handler: (ctx, { job }) => ctx.db.insert('cronRuns', { job, startedAt: Date.now(), ok: false }),
});

export const close = internalMutation({
  args: {
    id: v.id('cronRuns'),
    ok: v.boolean(),
    error: v.optional(v.string()),
    // Sólo lo que el job devuelve: cuentas y totales, nunca contenido.
    result: v.optional(v.any()),
  },
  handler: async (ctx, { id, ...outcome }) => {
    await ctx.db.patch(id, { ...outcome, finishedAt: Date.now() });
    return null;
  },
});

/** La última vez que cada job terminó bien. */
export const lastSuccesses = internalQuery({
  args: {},
  handler: async (ctx) =>
    Promise.all(
      CRON_JOB_NAMES.map(async (job) => {
        const row = await ctx.db
          .query('cronRuns')
          .withIndex('by_job_started', (q) => q.eq('job', job))
          .order('desc')
          .filter((q) => q.eq(q.field('ok'), true))
          .first();
        return { job, at: row?.finishedAt ?? null };
      }),
    ),
});

/**
 * Poda la bitácora. Los recordatorios corren cada quince minutos, o sea unas
 * 2.900 filas al mes: sin poda la tabla crece sola sin que nadie la mire. Un
 * mes es de sobra para lo único que se consulta, que es "cuándo fue la última".
 */
export const prune = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;
    let deleted = 0;
    for (const job of CRON_JOB_NAMES) {
      const old = await ctx.db
        .query('cronRuns')
        .withIndex('by_job_started', (q) => q.eq('job', job).lt('startedAt', cutoff))
        .collect();
      for (const row of old) await ctx.db.delete(row._id);
      deleted += old.length;
    }
    return deleted;
  },
});

/**
 * Envuelve el trabajo de un cron y deja constancia de cómo fue. El error se
 * relanza después de anotarlo: así la ejecución sale en rojo en el panel de
 * Convex, que es donde se mira.
 */
export async function withCronRun<T>(ctx: ActionCtx, job: CronJobName, run: () => Promise<T>): Promise<T> {
  // Anotado a mano: el tipo de `internal` incluye este módulo y sin él el compilador cicla.
  let runId: Id<'cronRuns'> | null = null;
  try {
    runId = await ctx.runMutation(internal.cronRuns.open, { job });
  } catch (error) {
    console.error('[cron] no se pudo abrir la fila de bitácora:', error);
  }
  const close = async (outcome: { ok: boolean; result?: unknown; error?: string }) => {
    if (!runId) return;
    try {
      await ctx.runMutation(internal.cronRuns.close, { id: runId, ...outcome });
    } catch (error) {
      console.error('[cron] no se pudo cerrar la fila de bitácora:', error);
    }
  };
  try {
    const result = await run();
    await close({ ok: true, result });
    return result;
  } catch (error) {
    await close({ ok: false, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/** Los jobs que llevan demasiado callados, con su aviso ya escrito en el log. */
export async function reportStaleCrons(ctx: ActionCtx, now = Date.now()): Promise<StaleCron[]> {
  try {
    const last: Array<{ job: string; at: number | null }> = await ctx.runQuery(internal.cronRuns.lastSuccesses, {});
    const stale = findStaleCrons(
      last.flatMap((entry) => (isCronJobName(entry.job) ? [{ job: entry.job, at: entry.at }] : [])),
      now,
    );
    // Un mensaje por job, no uno agregado: cada uno se lee y se resuelve por separado.
    for (const cron of stale) console.error(`[cron] ${cron.reason}`);
    return stale;
  } catch (error) {
    console.error('[cron] no se pudo revisar la salud de los crons:', error);
    return [];
  }
}
