'use node';

import webpush from 'web-push';
import { v } from 'convex/values';
import { internalAction, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

// El envío de push corre en Node porque `web-push` lo exige. Sólo marca como
// avisado lo que de verdad se entregó; lo que falla se reintenta en el
// siguiente cron.

type Payload = { title: string; body: string; url?: string };
type Delivery = {
  userId: Id<'users'>;
  dueToday: Array<{ id: Id<'tasks'>; title: string }>;
  dueTomorrow: Array<{ id: Id<'tasks'>; title: string }>;
  reminders: Array<{ id: Id<'taskReminders'>; label: string | null; taskTitle: string }>;
  escalations: Array<{ id: Id<'tasks'>; title: string; priority: string }>;
};

const PRIORITY_LABEL: Record<string, string> = { critical: 'Crítico', high: 'Alta prioridad', medium: 'Pendiente', low: 'Pendiente' };

function vapidConfigured(): boolean {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@kino.app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return true;
}

function summary(items: Array<{ title: string }>): string {
  const rest = items.length - 1;
  return items.length === 1 ? items[0]!.title : `${items[0]!.title} y ${rest} tarea${rest > 1 ? 's' : ''} más`;
}

export const sendTaskReminders = internalAction({
  args: {},
  returns: v.object({ notified: v.number() }),
  handler: async (ctx) => {
    if (!vapidConfigured()) return { notified: 0 };
    let notified = 0;
    // Anotado a mano: el tipo de `internal` incluye este módulo y sin él el compilador cicla.
    const pending: Delivery[] = await ctx.runQuery(internal.notifications.pendingDeliveries, {});
    for (const entry of pending) {
      const delivered = { dueToday: [] as Id<'tasks'>[], dueTomorrow: [] as Id<'tasks'>[], reminders: [] as Id<'taskReminders'>[], escalations: [] as Id<'tasks'>[] };
      const send = (payload: Payload) => sendToUser(ctx, entry.userId, payload);
      if (entry.dueToday.length && (await send({ title: `Vence hoy${entry.dueToday.length > 1 ? ` · ${entry.dueToday.length}` : ''}`, body: summary(entry.dueToday), url: '/tasks' }))) {
        delivered.dueToday = entry.dueToday.map((t) => t.id);
        notified += entry.dueToday.length;
      }
      if (entry.dueTomorrow.length && (await send({ title: `Vence mañana${entry.dueTomorrow.length > 1 ? ` · ${entry.dueTomorrow.length}` : ''}`, body: summary(entry.dueTomorrow), url: '/tasks' }))) {
        delivered.dueTomorrow = entry.dueTomorrow.map((t) => t.id);
        notified += entry.dueTomorrow.length;
      }
      for (const reminder of entry.reminders) {
        if (await send({ title: reminder.label ?? 'Recordatorio', body: reminder.taskTitle, url: '/tasks' })) {
          delivered.reminders.push(reminder.id);
          notified += 1;
        }
      }
      for (const task of entry.escalations) {
        // El título viaja a la pantalla de bloqueo del teléfono: la urgencia va en palabras.
        await send({ title: `${PRIORITY_LABEL[task.priority] ?? 'Pendiente'} · sin completar`, body: task.title, url: '/tasks' });
        delivered.escalations.push(task.id);
        notified += 1;
      }
      await ctx.runMutation(internal.notifications.markDelivered, delivered);
    }
    return { notified };
  },
});

/** Un push a todas las suscripciones de la persona. `true` si alguna lo recibió. */
async function sendToUser(ctx: Pick<ActionCtx, 'runQuery' | 'runMutation'>, userId: Id<'users'>, payload: Payload): Promise<boolean> {
  const subscriptions: Array<{ endpoint: string; authKey: string; p256dhKey: string }> = await ctx.runQuery(internal.notifications.subscriptionsOf, { userId });
  const serialized = JSON.stringify(payload);
  let anyDelivered = false;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.authKey, p256dh: sub.p256dhKey } }, serialized);
      anyDelivered = true;
    } catch (error) {
      // 410: la suscripción murió en el navegador; se retira para no insistir.
      if (error instanceof Error && 'statusCode' in error && (error as { statusCode: number }).statusCode === 410) {
        await ctx.runMutation(internal.notifications.dropSubscription, { endpoint: sub.endpoint });
      }
    }
  }
  return anyDelivered;
}
