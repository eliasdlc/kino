import { auth } from '@/auth';
import { headers } from 'next/headers';
import { z } from 'zod';
import { upsertPushSubscription } from '@/features/notifications/notifications.queries';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
});

// Session-only a propósito (KIN-144): requiere el PushSubscription del
// navegador, que sólo existe en una sesión de UI. No migrar a getAuthContext.
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  const body: unknown = await req.json();
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;
  await upsertPushSubscription(session.user.id, { endpoint, auth: keys.auth, p256dh: keys.p256dh });

  return Response.json({ ok: true }, { status: 201 });
}
