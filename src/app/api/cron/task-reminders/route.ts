import { sendTaskReminders } from '@/features/notifications/notifications.service';
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

  const result = await withCronRun('task-reminders', sendTaskReminders);
  return Response.json({ ok: true, ...result });
}

// Lo dispara un cron externo (cron-job.org, cada 15 min para los remind_at
// exactos — ver el doc "Operación — cron externo de reminders (D4)" en Linear),
// no Vercel: `vercel.json` sólo tiene una entrada y el plan gratuito no admite
// una cadencia de quince minutos. Acepta GET y POST porque el disparador
// externo puede usar cualquiera de los dos, con el mismo guard por Bearer.
//
// Al vivir fuera del repo, su fallo sería invisible: por eso cada ejecución
// queda en `cron_runs` y el snapshot diario avisa si esto lleva callado más de
// dos horas (KIN-166).
export const GET = handle;
export const POST = handle;
