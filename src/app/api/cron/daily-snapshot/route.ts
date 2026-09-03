import * as Sentry from '@sentry/nextjs';
import { runDailySnapshotForActiveUsers } from '@/features/scheduler/scheduler.service';
import { pruneStaleRateLimits } from '@/shared/rate-limit/store';
import { pruneOldCronRuns, reportStaleCrons, withCronRun } from '@/shared/observability/cron-runs';

export const maxDuration = 10;

export async function GET(req: Request) {
  // Sin secret configurado, comparar contra `Bearer undefined` dejaría pasar a
  // cualquiera: fallar cerrado (500) es más seguro que autenticar por accidente.
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronRun('daily-snapshot', runDailySnapshotForActiveUsers);

  // Este es el único cron que Vercel garantiza, así que es el que vigila a los
  // dos que dependen de un disparador externo (KIN-166). Va después del trabajo
  // de verdad: si la vigilancia falla, el snapshot ya está hecho.
  const staleCrons = await reportStaleCrons();

  // Va colgado de este cron y no del suyo propio porque el free tier de Vercel
  // sólo admite una entrada en `vercel.json`. Si falla, el snapshot no se cae
  // con él: la poda es higiene, no parte del resultado.
  let prunedRateLimits = 0;
  let prunedCronRuns = 0;
  try {
    prunedRateLimits = await pruneStaleRateLimits();
    prunedCronRuns = await pruneOldCronRuns();
  } catch (error) {
    // El único error de todo el fichero que no sale por la respuesta, así que
    // tampoco lo vería `onRequestError`. Si no se reporta aquí, la tabla de
    // contadores crece durante meses sin que nadie se entere.
    Sentry.captureException(error, { tags: { layer: 'cron', cron: 'daily-snapshot' } });
    console.error('[cron] no se pudo podar:', error);
  }

  return Response.json({
    ok: true,
    ...result,
    prunedRateLimits,
    prunedCronRuns,
    // Los jobs que llevan demasiado callados, para poder verlo también a mano.
    staleCrons: staleCrons.map((cron) => cron.job),
  });
}
