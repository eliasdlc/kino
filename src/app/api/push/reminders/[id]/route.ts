import { NextRequest } from 'next/server';
import { getAuthContext } from '@/shared/utils/auth-context';
import { deleteTaskReminder } from '@/features/notifications/notifications.queries';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authContext = await getAuthContext(req);
  if (!authContext) {
    return Response.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteTaskReminder(id, authContext.userId);

  if (!deleted) return Response.json({ code: 'NOT_FOUND' }, { status: 404 });

  return Response.json({ ok: true });
}
