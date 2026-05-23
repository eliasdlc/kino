import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { pushSubscriptions } from '@/shared/db/schema';

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
