import { z } from 'zod';
import { deletePushSubscription } from '@/features/notifications/notifications.queries';
import { getServerSession } from '@/shared/utils/session';

const schema = z.object({ endpoint: z.string().url() });

// Session-only a propósito (KIN-144): opera sobre el PushSubscription del
// navegador, que sólo existe en una sesión de UI. No migrar a getAuthContext.
export async function DELETE(req: Request) {
  const session = await getServerSession();
  if (!session) return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  const body: unknown = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });
  }

  await deletePushSubscription(parsed.data.endpoint);
  return new Response(null, { status: 204 });
}
