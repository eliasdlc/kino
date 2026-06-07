import { auth } from '@/auth';
import { headers } from 'next/headers';
import { deleteTaskReminder } from '@/features/notifications/notifications.queries';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  const { id } = await params;
  const deleted = await deleteTaskReminder(id, session.user.id);

  if (!deleted) return Response.json({ code: 'NOT_FOUND' }, { status: 404 });

  return Response.json({ ok: true });
}
