import { runDailySnapshotForActiveUsers } from '@/features/scheduler/scheduler.service';
import { pruneStaleRateLimits } from '@/shared/rate-limit/store';

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

  const result = await runDailySnapshotForActiveUsers();

  // Va colgado de este cron y no del suyo propio porque el free tier de Vercel
  // sólo admite una entrada en `vercel.json`. Si falla, el snapshot no se cae
  // con él: la poda es higiene, no parte del resultado.
  let prunedRateLimits = 0;
  try {
    prunedRateLimits = await pruneStaleRateLimits();
  } catch (error) {
    console.error('[cron] no se pudo podar rate_limits:', error);
  }

  return Response.json({ ok: true, ...result, prunedRateLimits });
}
