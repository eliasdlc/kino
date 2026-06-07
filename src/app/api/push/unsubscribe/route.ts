import { auth } from '@/auth';
import { headers } from 'next/headers';
import { z } from 'zod';
import { deletePushSubscription } from '@/features/notifications/notifications.queries';

const schema = z.object({ endpoint: z.string().url() });

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  const body: unknown = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });
  }

  await deletePushSubscription(parsed.data.endpoint);
  return new Response(null, { status: 204 });
}
