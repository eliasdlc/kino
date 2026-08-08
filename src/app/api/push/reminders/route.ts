import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/shared/utils/auth-context';
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

export async function GET(req: NextRequest) {
  const authContext = await getAuthContext(req);
  if (!authContext) {
    return Response.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get('taskId');
  if (!taskId) return Response.json({ code: 'INVALID_INPUT' }, { status: 400 });

  const reminders = await getTaskRemindersForTask(taskId, authContext.userId);
  return Response.json(reminders);
}

export async function POST(req: NextRequest) {
  const authContext = await getAuthContext(req);
  if (!authContext) {
    return Response.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ code: 'INVALID_INPUT', details: parsed.error.flatten() }, { status: 400 });
  }

  const { taskId, remindAt, label } = parsed.data;

  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, authContext.userId), isNull(tasks.deletedAt)));

  if (!task) return Response.json({ code: 'NOT_FOUND' }, { status: 404 });

  const reminder = await createTaskReminder({
    taskId,
    userId: authContext.userId,
    remindAt: new Date(remindAt),
    label,
  });

  return Response.json(reminder, { status: 201 });
}
