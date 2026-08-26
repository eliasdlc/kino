import { eq, and, isNull, inArray } from 'drizzle-orm';
import { db } from '@/shared/db';
import { pushSubscriptions, tasks, taskReminders, users } from '@/shared/db/schema';
import { sql } from 'drizzle-orm';

export async function getPushSubscriptions(userId: string) {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

export async function upsertPushSubscription(
  userId: string,
  sub: { endpoint: string; auth: string; p256dh: string },
) {
  const [row] = await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, authKey: sub.auth, p256dhKey: sub.p256dh })
    .onConflictDoUpdate({
      target: [pushSubscriptions.endpoint],
      set: { authKey: sub.auth, p256dhKey: sub.p256dh },
    })
    .returning();
  return row;
}

export async function deletePushSubscription(endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function getUserIdsWithPushSubscriptions(): Promise<string[]> {
  // Excluye a quienes desactivaron notificaciones. La ausencia de fila en
  // user_settings cuenta como habilitado (default true del schema).
  const rows = await db.execute<{ user_id: string }>(sql`
    SELECT DISTINCT ps.user_id
    FROM push_subscriptions ps
    WHERE NOT EXISTS (
      SELECT 1 FROM user_settings us
      WHERE us.user_id = ps.user_id AND us.notifications_enabled = false
    )
  `);
  return [...rows].map((r) => r.user_id);
}

export async function getTasksDueTodayUnnotified(userIds: string[]) {
  if (userIds.length === 0) return [];
  // Compara el día calendario en la tz del usuario, no en UTC: un dueDate
  // timestamptz con hora (lo que guarda el autosave) cae en el día correcto.
  return db
    .select({ id: tasks.id, userId: tasks.userId, title: tasks.title })
    .from(tasks)
    .innerJoin(users, eq(tasks.userId, users.id))
    .where(
      and(
        inArray(tasks.userId, userIds),
        sql`(${tasks.dueDate} AT TIME ZONE ${users.timezone})::date = (NOW() AT TIME ZONE ${users.timezone})::date`,
        eq(tasks.notifiedDueDay, false),
        isNull(tasks.completedAt),
        sql`${tasks.status} NOT IN ('done', 'archived')`,
        isNull(tasks.deletedAt),
      ),
    );
}

export async function getTasksDueTomorrowUnnotified(userIds: string[]) {
  if (userIds.length === 0) return [];
  return db
    .select({ id: tasks.id, userId: tasks.userId, title: tasks.title })
    .from(tasks)
    .innerJoin(users, eq(tasks.userId, users.id))
    .where(
      and(
        inArray(tasks.userId, userIds),
        sql`(${tasks.dueDate} AT TIME ZONE ${users.timezone})::date = (NOW() AT TIME ZONE ${users.timezone})::date + 1`,
        eq(tasks.notifiedBeforeDay, false),
        isNull(tasks.completedAt),
        sql`${tasks.status} NOT IN ('done', 'archived')`,
        isNull(tasks.deletedAt),
      ),
    );
}

export async function markTasksNotifiedDueDay(taskIds: string[]) {
  if (taskIds.length === 0) return;
  await db
    .update(tasks)
    .set({ notifiedDueDay: true })
    .where(inArray(tasks.id, taskIds));
}

export async function markTasksNotifiedBeforeDay(taskIds: string[]) {
  if (taskIds.length === 0) return;
  await db
    .update(tasks)
    .set({ notifiedBeforeDay: true })
    .where(inArray(tasks.id, taskIds));
}

export interface PendingReminder {
  id: string;
  taskId: string;
  userId: string;
  label: string | null;
  taskTitle: string;
}

export async function getPendingReminders(): Promise<PendingReminder[]> {
  const rows = await db.execute<{
    id: string;
    task_id: string;
    user_id: string;
    label: string | null;
    task_title: string;
  }>(sql`
    SELECT tr.id, tr.task_id, tr.user_id, tr.label, t.title AS task_title
    FROM task_reminders tr
    INNER JOIN tasks t ON t.id = tr.task_id
    WHERE tr.remind_at <= NOW()
      AND tr.sent_at IS NULL
      AND t.completed_at IS NULL
      AND t.status NOT IN ('done', 'archived')
      AND t.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = tr.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM user_settings us
        WHERE us.user_id = tr.user_id AND us.notifications_enabled = false
      )
  `);
  return [...rows].map((r) => ({
    id: r.id,
    taskId: r.task_id,
    userId: r.user_id,
    label: r.label,
    taskTitle: r.task_title,
  }));
}

export async function markRemindersSent(ids: string[]) {
  if (ids.length === 0) return;
  await db
    .update(taskReminders)
    .set({ sentAt: new Date() })
    .where(inArray(taskReminders.id, ids));
}

export interface EscalationTask {
  id: string;
  userId: string;
  title: string;
  priority: string;
  reminderCount: number;
}

export async function getTasksForEscalation(): Promise<EscalationTask[]> {
  const rows = await db.execute<{
    id: string;
    user_id: string;
    title: string;
    priority: string;
    reminder_count: number;
  }>(sql`
    SELECT t.id, t.user_id, t.title, t.priority, t.reminder_count
    FROM tasks t
    INNER JOIN users u ON u.id = t.user_id
    WHERE t.notified_due_day = true
      AND t.completed_at IS NULL
      AND t.status NOT IN ('done', 'archived')
      AND t.deleted_at IS NULL
      AND t.due_date IS NOT NULL
      AND (t.due_date AT TIME ZONE u.timezone)::date <= (NOW() AT TIME ZONE u.timezone)::date
      AND t.reminder_count < CASE t.priority
        WHEN 'critical' THEN 14
        WHEN 'high' THEN 7
        WHEN 'medium' THEN 4
        WHEN 'low' THEN 2
        ELSE 0
      END
      AND (
        t.last_reminded_at IS NULL
        OR t.last_reminded_at < NOW() - CASE t.priority
          WHEN 'critical' THEN INTERVAL '6 hours'
          WHEN 'high' THEN INTERVAL '6 hours'
          WHEN 'medium' THEN INTERVAL '48 hours'
          WHEN 'low' THEN INTERVAL '72 hours'
          ELSE INTERVAL '999 days'
        END
      )
      AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = t.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM user_settings us
        WHERE us.user_id = t.user_id AND us.notifications_enabled = false
      )
  `);
  return [...rows].map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    priority: r.priority,
    reminderCount: r.reminder_count,
  }));
}

export async function updateTaskEscalation(taskIds: string[]) {
  if (taskIds.length === 0) return;
  await db.update(tasks)
    .set({
      reminderCount: sql`${tasks.reminderCount} + 1`,
      lastRemindedAt: sql`NOW()`,
    })
    .where(inArray(tasks.id, taskIds));
}

export async function getTaskRemindersForTask(taskId: string, userId: string) {
  return db
    .select()
    .from(taskReminders)
    .where(and(eq(taskReminders.taskId, taskId), eq(taskReminders.userId, userId)))
    .orderBy(taskReminders.remindAt);
}

/**
 * ¿Es tuya y sigue viva la tarea a la que quieres ponerle recordatorio? Vive
 * aquí y no en la ruta, que es donde estaba con SQL a mano.
 */
export async function ownsActiveTask(taskId: string, userId: string): Promise<boolean> {
  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)));
  return !!task;
}

export async function createTaskReminder(data: {
  taskId: string;
  userId: string;
  remindAt: Date;
  label?: string;
}) {
  const [row] = await db
    .insert(taskReminders)
    .values({ ...data, source: 'user' })
    .returning();
  return row;
}

export async function deleteTaskReminder(reminderId: string, userId: string) {
  const [row] = await db
    .delete(taskReminders)
    .where(and(eq(taskReminders.id, reminderId), eq(taskReminders.userId, userId), isNull(taskReminders.sentAt)))
    .returning();
  return row ?? null;
}
