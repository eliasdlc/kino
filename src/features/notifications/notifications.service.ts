import webpush from 'web-push';
import { getPushSubscriptions, deletePushSubscription } from './notifications.queries';

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
