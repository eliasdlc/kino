import { eq, and, isNull, inArray } from 'drizzle-orm';
import { db } from '@/shared/db';
import { pushSubscriptions, tasks } from '@/shared/db/schema';
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

// Returns unique user IDs that have at least one push subscription
export async function getUserIdsWithPushSubscriptions(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions);
  return rows.map((r) => r.userId);
}

// Tasks due today (in UTC date terms) that haven't sent the due-day reminder
export async function getTasksDueTodayUnnotified(userIds: string[]) {
  if (userIds.length === 0) return [];
  return db
    .select({ id: tasks.id, userId: tasks.userId, title: tasks.title })
    .from(tasks)
    .where(
      and(
        inArray(tasks.userId, userIds),
        sql`${tasks.dueDate} = CURRENT_DATE`,
        eq(tasks.notifiedDueDay, false),
        isNull(tasks.deletedAt),
      ),
    );
}

// Tasks due tomorrow (in UTC date terms) that haven't sent the before-day reminder
export async function getTasksDueTomorrowUnnotified(userIds: string[]) {
  if (userIds.length === 0) return [];
  return db
    .select({ id: tasks.id, userId: tasks.userId, title: tasks.title })
    .from(tasks)
    .where(
      and(
        inArray(tasks.userId, userIds),
        sql`${tasks.dueDate} = CURRENT_DATE + INTERVAL '1 day'`,
        eq(tasks.notifiedBeforeDay, false),
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
