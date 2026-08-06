import { sendTaskReminders } from '@/features/notifications/notifications.service';

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

  const result = await sendTaskReminders();
  return Response.json({ ok: true, ...result });
}

// Vercel Cron dispara por GET; un cron externo (cron-job.org, cada 15 min para
// los remind_at exactos — ver el doc "Operación — cron externo de reminders (D4)"
// en Linear) puede usar cualquiera de
// los dos. Ambos comparten el mismo guard por Bearer CRON_SECRET.
export const GET = handle;
export const POST = handle;
