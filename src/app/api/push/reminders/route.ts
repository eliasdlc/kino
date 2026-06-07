import { auth } from '@/auth';
import { headers } from 'next/headers';
import { z } from 'zod';
import {
  getTaskRemindersForTask,
  createTaskReminder,
} from '@/features/notifications/notifications.queries';
import { db } from '@/shared/db';
import { tasks } from '@/shared/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

const createSchema = z.object({
  taskId: z.string().uuid(),
  remindAt: z.string().datetime(),
  label: z.string().max(255).optional(),
});

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get('taskId');
  if (!taskId) return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });

  const reminders = await getTaskRemindersForTask(taskId, session.user.id);
  return Response.json(reminders);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ code: 'UNAUTHORIZED' }, { status: 401 });

  const body: unknown = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  }

  const { taskId, remindAt, label } = parsed.data;

  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)));

  if (!task) return Response.json({ code: 'NOT_FOUND' }, { status: 404 });

  const reminder = await createTaskReminder({
    taskId,
    userId: session.user.id,
    remindAt: new Date(remindAt),
    label,
  });

  return Response.json(reminder, { status: 201 });
}
