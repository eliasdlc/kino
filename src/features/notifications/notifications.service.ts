import webpush from 'web-push';
import {
  getPushSubscriptions,
  deletePushSubscription,
  getUserIdsWithPushSubscriptions,
  getTasksDueTodayUnnotified,
  getTasksDueTomorrowUnnotified,
  markTasksNotifiedDueDay,
  markTasksNotifiedBeforeDay,
  getPendingReminders,
  markRemindersSent,
  getTasksForEscalation,
  updateTaskEscalation,
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

export async function sendTaskReminders(): Promise<{ notified: number }> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return { notified: 0 };
  }

  const [standard, custom, escalation] = await Promise.all([
    sendStandardReminders(),
    sendPendingReminders(),
    sendEscalationReminders(),
  ]);

  return { notified: standard + custom + escalation };
}

async function sendStandardReminders(): Promise<number> {
  const userIds = await getUserIdsWithPushSubscriptions();
  if (userIds.length === 0) return 0;

  const [todayTasks, tomorrowTasks] = await Promise.all([
    getTasksDueTodayUnnotified(userIds),
    getTasksDueTomorrowUnnotified(userIds),
  ]);

  const byUser = new Map<string, { today: { id: string; title: string }[]; tomorrow: { id: string; title: string }[] }>();
  for (const t of todayTasks) {
    const entry = byUser.get(t.userId) ?? { today: [], tomorrow: [] };
    entry.today.push({ id: t.id, title: t.title });
    byUser.set(t.userId, entry);
  }
  for (const t of tomorrowTasks) {
    const entry = byUser.get(t.userId) ?? { today: [], tomorrow: [] };
    entry.tomorrow.push({ id: t.id, title: t.title });
    byUser.set(t.userId, entry);
  }

  let notified = 0;
  // Sólo marcamos como notificadas las tareas cuyo push de verdad se entregó;
  // si el envío falla, quedan sin marcar y el próximo cron las reintenta.
  const deliveredTodayIds: string[] = [];
  const deliveredTomorrowIds: string[] = [];

  await Promise.allSettled(
    [...byUser.entries()].map(async ([userId, { today, tomorrow }]) => {
      if (today.length > 0) {
        const body = today.length === 1
          ? today[0]!.title
          : `${today[0]!.title} y ${today.length - 1} tarea${today.length - 1 > 1 ? 's' : ''} más`;
        const delivered = await sendPushToUser(userId, {
          title: `Vence hoy${today.length > 1 ? ` · ${today.length}` : ''}`,
          body,
          url: '/tasks',
        });
        if (delivered) {
          deliveredTodayIds.push(...today.map((t) => t.id));
          notified += today.length;
        }
      }

      if (tomorrow.length > 0) {
        const body = tomorrow.length === 1
          ? tomorrow[0]!.title
          : `${tomorrow[0]!.title} y ${tomorrow.length - 1} tarea${tomorrow.length - 1 > 1 ? 's' : ''} más`;
        const delivered = await sendPushToUser(userId, {
          title: `Vence mañana${tomorrow.length > 1 ? ` · ${tomorrow.length}` : ''}`,
          body,
          url: '/tasks',
        });
        if (delivered) {
          deliveredTomorrowIds.push(...tomorrow.map((t) => t.id));
          notified += tomorrow.length;
        }
      }
    }),
  );

  await Promise.all([
    markTasksNotifiedDueDay(deliveredTodayIds),
    markTasksNotifiedBeforeDay(deliveredTomorrowIds),
  ]);

  return notified;
}

async function sendPendingReminders(): Promise<number> {
  const pending = await getPendingReminders();
  if (pending.length === 0) return 0;

  // Sólo marcamos enviados los reminders cuyo push resolvió; los que fallan
  // quedan con sent_at NULL y se reintentan en el próximo cron.
  const deliveredIds: string[] = [];
  await Promise.allSettled(
    pending.map(async ({ id, userId, taskTitle, label }) => {
      const delivered = await sendPushToUser(userId, {
        title: label ?? 'Recordatorio',
        body: taskTitle,
        url: '/tasks',
      });
      if (delivered) deliveredIds.push(id);
    }),
  );

  await markRemindersSent(deliveredIds);

  return deliveredIds.length;
}

async function sendEscalationReminders(): Promise<number> {
  const tasks = await getTasksForEscalation();
  if (tasks.length === 0) return 0;

  // El título viaja a la pantalla de bloqueo del teléfono, donde no hay iconos
  // que renderizar: la urgencia tiene que estar en las palabras.
  const PRIORITY_LABEL: Record<string, string> = {
    critical: 'Crítico',
    high: 'Alta prioridad',
    medium: 'Pendiente',
    low: 'Pendiente',
  };

  await Promise.allSettled(
    tasks.map(({ userId, title, priority }) =>
      sendPushToUser(userId, {
        title: `${PRIORITY_LABEL[priority] ?? 'Pendiente'} · sin completar`,
        body: title,
        url: '/tasks',
      }),
    ),
  );

  await updateTaskEscalation(tasks.map((t) => t.id));

  return tasks.length;
}

/**
 * Envía un push a todas las subscriptions del usuario.
 * @returns true si al menos una entrega resolvió (base para marcar la tarea como
 * notificada sólo cuando de verdad se entregó; si todas fallan, retornar false
 * la deja re-intentable en el próximo cron).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<boolean> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;

  const subscriptions = await getPushSubscriptions(userId);
  if (subscriptions.length === 0) return false;

  const serialized = JSON.stringify(payload);

  let anyDelivered = false;
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { auth: sub.authKey, p256dh: sub.p256dhKey } },
          serialized,
        );
        anyDelivered = true;
      } catch (err) {
        if (err instanceof Error && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          await deletePushSubscription(sub.endpoint);
        }
      }
    }),
  );
  return anyDelivered;
}
