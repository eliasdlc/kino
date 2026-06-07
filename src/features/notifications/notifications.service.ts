import webpush from 'web-push';
import {
  getPushSubscriptions,
  deletePushSubscription,
  getUserIdsWithPushSubscriptions,
  getTasksDueTodayUnnotified,
  getTasksDueTomorrowUnnotified,
  markTasksNotifiedDueDay,
  markTasksNotifiedBeforeDay,
} from './notifications.queries';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@kino.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Envía una notificación push a todos los endpoints del usuario.
 * Si un endpoint devuelve 410 (Gone), se elimina de la base de datos.
 */
export async function sendTaskReminders(): Promise<{ notified: number }> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return { notified: 0 };
  }

  const userIds = await getUserIdsWithPushSubscriptions();
  if (userIds.length === 0) return { notified: 0 };

  const [todayTasks, tomorrowTasks] = await Promise.all([
    getTasksDueTodayUnnotified(userIds),
    getTasksDueTomorrowUnnotified(userIds),
  ]);

  // Group by userId
  const byUser = new Map<string, { today: string[]; tomorrow: string[] }>();
  for (const t of todayTasks) {
    const entry = byUser.get(t.userId) ?? { today: [], tomorrow: [] };
    entry.today.push(t.title);
    byUser.set(t.userId, entry);
  }
  for (const t of tomorrowTasks) {
    const entry = byUser.get(t.userId) ?? { today: [], tomorrow: [] };
    entry.tomorrow.push(t.title);
    byUser.set(t.userId, entry);
  }

  let notified = 0;

  await Promise.allSettled(
    [...byUser.entries()].map(async ([userId, { today, tomorrow }]) => {
      if (today.length > 0) {
        const body =
          today.length === 1
            ? today[0]
            : `${today[0]} y ${today.length - 1} tarea${today.length - 1 > 1 ? 's' : ''} más`;
        await sendPushToUser(userId, {
          title: `Kino · Vence hoy${today.length > 1 ? ` (${today.length})` : ''}`,
          body,
          url: '/tasks',
        });
        notified += today.length;
      }

      if (tomorrow.length > 0) {
        const body =
          tomorrow.length === 1
            ? tomorrow[0]
            : `${tomorrow[0]} y ${tomorrow.length - 1} tarea${tomorrow.length - 1 > 1 ? 's' : ''} más`;
        await sendPushToUser(userId, {
          title: `Kino · Vence mañana${tomorrow.length > 1 ? ` (${tomorrow.length})` : ''}`,
          body,
          url: '/tasks',
        });
        notified += tomorrow.length;
      }
    }),
  );

  // Mark as notified after sending to avoid duplicates
  const todayIds = todayTasks.map((t) => t.id);
  const tomorrowIds = tomorrowTasks.map((t) => t.id);
  await Promise.all([
    markTasksNotifiedDueDay(todayIds),
    markTasksNotifiedBeforeDay(tomorrowIds),
  ]);

  return { notified };
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const subscriptions = await getPushSubscriptions(userId);
  if (subscriptions.length === 0) return;

  const serialized = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.authKey, p256dh: sub.p256dhKey } },
          serialized,
        );
      } catch (err) {
        // Suscripción expirada o inválida → limpiar
        if (err instanceof Error && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          await deletePushSubscription(sub.endpoint);
        }
      }
    }),
  );
}
