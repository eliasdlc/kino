import { sendTaskReminders } from '@/features/notifications/notifications.service';

export const maxDuration = 10;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await sendTaskReminders();
  return Response.json({ ok: true, ...result });
}
