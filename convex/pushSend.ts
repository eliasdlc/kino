'use node';

import webpush from 'web-push';
import { v } from 'convex/values';
import { internalAction, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { repartir, type Delivery, type Payload } from './lib/reparto';

// El envío de push corre en Node porque `web-push` lo exige. Quién recibe qué y
// con qué texto lo decide `lib/reparto`, que no sabe de red: aquí sólo queda
// pedir la tanda, mandarla y dejar constancia de lo que sí salió.
//
// ── Por qué estos avisos no pasan por la cola de una sola interrupción ──────
// La cola de `convex/today.ts` gobierna lo único que Kino pregunta dentro de
// Hoy, una vez al día. Un push no pregunta nada: dice que algo vence hoy, y eso
// es un hecho con hora que sólo sirve cuando ocurre. Guardarlo para la apertura
// del día siguiente lo convierte en un aviso de algo que ya venció.
//
// Quedan por tanto **exentos a propósito**, y el límite de la exención es que
// una pasada del cron no mande cuatro avisos seguidos a la misma persona: por
// eso las escaladas viajan agrupadas en uno solo.

function vapidConfigured(): boolean {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@kino.app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return true;
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
      const tanda = await repartir(entry, (payload) => sendToUser(ctx, entry.userId, payload));
      notified += tanda.notified;
      await ctx.runMutation(internal.notifications.markDelivered, tanda.delivered);
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
