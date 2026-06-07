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
        const body = today.length === 1
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
        const body = tomorrow.length === 1
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

  const todayIds = todayTasks.map((t) => t.id);
  const tomorrowIds = tomorrowTasks.map((t) => t.id);
  await Promise.all([
    markTasksNotifiedDueDay(todayIds),
    markTasksNotifiedBeforeDay(tomorrowIds),
  ]);

  return notified;
}

async function sendPendingReminders(): Promise<number> {
  const pending = await getPendingReminders();
  if (pending.length === 0) return 0;

  await Promise.allSettled(
    pending.map(({ userId, taskTitle, label }) =>
      sendPushToUser(userId, {
        title: label ? `Kino · ${label}` : 'Kino · Recordatorio',
        body: taskTitle,
        url: '/tasks',
      }),
    ),
  );

  await markRemindersSent(pending.map((r) => r.id));

  return pending.length;
}

async function sendEscalationReminders(): Promise<number> {
  const tasks = await getTasksForEscalation();
  if (tasks.length === 0) return 0;

  const PRIORITY_LABEL: Record<string, string> = {
    critical: '🔴 Crítico',
    high: '🟠 Alta prioridad',
    medium: 'Pendiente',
    low: 'Pendiente',
  };

  await Promise.allSettled(
    tasks.map(({ userId, title, priority }) =>
      sendPushToUser(userId, {
        title: `Kino · ${PRIORITY_LABEL[priority] ?? 'Pendiente'} — sin completar`,
        body: title,
        url: '/tasks',
      }),
    ),
  );

  await updateTaskEscalation(tasks.map((t) => t.id));

  return tasks.length;
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
        if (err instanceof Error && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          await deletePushSubscription(sub.endpoint);
        }
      }
    }),
  );
}
