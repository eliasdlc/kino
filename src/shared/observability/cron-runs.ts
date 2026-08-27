import * as Sentry from "@sentry/nextjs";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { cronRuns } from "@/shared/db/schema";
import {
  CRON_JOB_NAMES,
  findStaleCrons,
  type CronJobName,
  type LastSuccess,
  type StaleCron,
} from "./cron-health";

/**
 * La bitácora de las tareas programadas (KIN-166).
 *
 * Escribir una fila por ejecución es lo que convierte "no ha corrido" de una
 * ausencia de evidencia en una evidencia de la ausencia. Sin esto, un cron
 * externo que deja de dispararse no se distingue de uno que corre y no tiene
 * nada que hacer.
 *
 * Todo lo de aquí **falla abierto**: si la bitácora no se puede escribir, el
 * cron hace su trabajo igual. Un registro de vigilancia que tumba lo que vigila
 * es peor que no tenerlo.
 */

/**
 * Envuelve el trabajo de un cron y deja constancia de cómo fue.
 *
 * El error se relanza después de anotarlo: quien dispara el cron —Vercel o el
 * servicio externo— necesita ver el 500 para reintentar, y `onRequestError` de
 * Next lo manda a Sentry con la traza completa.
 */
export async function withCronRun<T>(job: CronJobName, run: () => Promise<T>): Promise<T> {
  const runId = await openRun(job);

  try {
    const result = await run();
    await closeRun(runId, { ok: true, result });
    return result;
  } catch (error) {
    await closeRun(runId, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function openRun(job: CronJobName): Promise<string | null> {
  try {
    const [row] = await db.insert(cronRuns).values({ job }).returning({ id: cronRuns.id });
    return row?.id ?? null;
  } catch (error) {
    console.error("[cron] no se pudo abrir la fila de bitácora:", error);
    return null;
  }
}

async function closeRun(
  runId: string | null,
  outcome: { ok: boolean; result?: unknown; error?: string },
): Promise<void> {
  if (!runId) return;
  try {
    await db
      .update(cronRuns)
      .set({
        finishedAt: new Date(),
        ok: outcome.ok,
        error: outcome.error ?? null,
        // Sólo lo que el job devuelve: cuentas y totales, nunca contenido.
        result: (outcome.result ?? null) as never,
      })
      .where(eq(cronRuns.id, runId));
  } catch (error) {
    console.error("[cron] no se pudo cerrar la fila de bitácora:", error);
  }
}

/**
 * La última vez que cada job terminó bien. Una consulta por job en vez de un
 * `DISTINCT ON`: son tres, y así la intención se lee sin saber SQL.
 */
export async function lastSuccessfulRuns(): Promise<LastSuccess[]> {
  return Promise.all(
    CRON_JOB_NAMES.map(async (job) => {
      const [row] = await db
        .select({ at: cronRuns.finishedAt })
        .from(cronRuns)
        .where(and(eq(cronRuns.job, job), eq(cronRuns.ok, true)))
        .orderBy(desc(cronRuns.finishedAt))
        .limit(1);

      return { job, at: row?.at ?? null };
    }),
  );
}

/**
 * Revisa el silencio de los tres jobs y avisa por los que llevan demasiado.
 *
 * Lo llama el snapshot diario, que es el único cron que Vercel sí garantiza: el
 * que no depende de nadie vigila a los que sí. La contrapartida honesta es que
 * si Vercel deja de disparar el snapshot, esta vigilancia calla con él, y por
 * eso el propio `daily-snapshot` está también en la lista de vigilados: su
 * ausencia sale en el aviso del día siguiente, cuando vuelva.
 */
export async function reportStaleCrons(now: number = Date.now()): Promise<StaleCron[]> {
  try {
    const stale = findStaleCrons(await lastSuccessfulRuns(), now);

    for (const cron of stale) {
      // Un mensaje por job, no uno agregado: en Sentry cada uno agrupa por su
      // cuenta y se resuelve por separado.
      Sentry.captureMessage(`[cron] ${cron.reason}`, {
        level: "error",
        tags: { layer: "cron-health", cron: cron.job, trigger: cron.trigger },
      });
      console.error(`[cron] ${cron.reason}`);
    }

    return stale;
  } catch (error) {
    console.error("[cron] no se pudo revisar la salud de los crons:", error);
    return [];
  }
}

/**
 * Poda la bitácora. Los recordatorios corren cada quince minutos, o sea unas
 * 2.900 filas al mes: sin poda la tabla crece sola sin que nadie la mire. Un mes
 * es de sobra para lo único que se consulta, que es "cuándo fue la última".
 */
export async function pruneOldCronRuns(): Promise<number> {
  const deleted = await db
    .delete(cronRuns)
    .where(sql`${cronRuns.startedAt} < now() - interval '30 days'`)
    .returning({ id: cronRuns.id });

  return deleted.length;
}
