import { sweepOrphanImagesForAllUsers } from '@/features/uploads/uploads.service';
import { withCronRun } from '@/shared/observability/cron-runs';

export const maxDuration = 10;

async function handle(req: Request) {
  // Sin secret configurado, comparar contra `Bearer undefined` dejaría pasar a
  // cualquiera: fallar cerrado (500) es más seguro que autenticar por accidente.
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronRun('blob-sweep', sweepOrphanImagesForAllUsers);
  return Response.json({ ok: true, ...result });
}

// Mismo guard que el resto de crons. No está en `vercel.json` a propósito: sigue el
// precedente de `task-reminders`, que dispara el cron externo — así añadir este
// barrido no consume una de las entradas de cron del free tier. Que quede
// `incomplete: true` no es un fallo: la siguiente vuelta sigue por donde tocaba.
//
// Como el disparador vive fuera del repo, cada ejecución queda en `cron_runs` y
// el snapshot diario avisa si este barrido lleva más de dos días sin correr
// (KIN-166).
export const GET = handle;
export const POST = handle;
