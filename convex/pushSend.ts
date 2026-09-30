'use node';

import webpush from 'web-push';
import { v } from 'convex/values';
import { internalAction, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { repartir, type Canales, type Correo, type Payload } from './lib/reparto';
import { firmarAccion } from './lib/firmaAccion';
import { enviarCorreo, correoConfigurado } from './lib/correo';
import type { Entrega } from './notifications';

// El envío de push y correo corre en Node porque `web-push` lo exige. Quién
// recibe qué y con qué texto lo decide `lib/reparto`, que no sabe de red: aquí
// sólo queda pedir la tanda, mandarla y dejar constancia de lo que sí salió.
//
// ── Por qué estos avisos no pasan por la cola de una sola interrupción ──────
// La cola de `convex/today.ts` gobierna lo único que Kino pregunta dentro de
// Hoy, una vez al día. Un push no pregunta nada: dice que algo vence, y eso es
// un hecho con hora que sólo sirve cuando ocurre. Guardarlo para la apertura
// del día siguiente lo convierte en un aviso de algo que ya venció.
//
// Quedan por tanto **exentos a propósito**, y el límite de la exención es que
// una pasada del cron no mande una ráfaga a la misma persona: los avisos de
// tareas de una vuelta viajan agrupados en uno solo.

function vapidConfigured(): boolean {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@kino.app', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  return true;
}

const appUrl = () => process.env.KINO_APP_URL ?? 'https://www.usekino.dev';

/** Los canales de una persona, listos para `repartir`. */
function canalesDe(ctx: Pick<ActionCtx, 'runQuery' | 'runMutation'>, userId: Id<'users'>, email: string, push: boolean): Canales {
  const secreto = process.env.VAPID_PRIVATE_KEY;
  const sitio = process.env.CONVEX_SITE_URL;
  return {
    push: push ? (payload) => sendToUser(ctx, userId, payload) : async () => ({ intentos: 0, entregado: false }),
    correo: correoConfigurado() ? (correo: Correo) => enviarCorreo(email, correo) : null,
    firmar: async (taskId) =>
      secreto && sitio ? { endpoint: `${sitio}/push/accion`, token: await firmarAccion(taskId, secreto, Date.now()) } : null,
    appUrl: appUrl(),
  };
}

export const sendTaskReminders = internalAction({
  args: {},
  returns: v.object({ notified: v.number(), push: v.boolean(), correo: v.boolean() }),
  handler: async (ctx) => {
    const push = vapidConfigured();
    // Sin push ni correo el cron no tiene por dónde avisar, y lo dice en su
    // resultado (`cronRuns`) en vez de responder `notified: 0` como si no
    // hubiera nada pendiente.
    if (!push) console.warn('[avisos] Push sin configurar: faltan VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY');
    if (!correoConfigurado()) console.warn('[avisos] Correo sin configurar: faltan RESEND_API_KEY o RESEND_FROM');

    // Anotado a mano: el tipo de `internal` incluye este módulo y sin él el compilador cicla.
    const { entregas, limpiar, descartar }: { entregas: Entrega[]; limpiar: Id<'tasks'>[]; descartar: Id<'taskReminders'>[] } =
      await ctx.runQuery(internal.notifications.pendientes, {});
    if (limpiar.length || descartar.length) {
      await ctx.runMutation(internal.notifications.limpiar, { tareas: limpiar, recordatorios: descartar });
    }

    let notified = 0;
    for (const entrega of entregas) {
      const { registro, notified: n } = await repartir(entrega, canalesDe(ctx, entrega.userId, entrega.email, push));
      notified += n;
      await ctx.runMutation(internal.notifications.registrar, {
        userId: entrega.userId,
        avisados: registro.avisados,
        reintentar: registro.reintentar,
        recordatorios: registro.recordatorios,
        tocaResumen: entrega.tocaResumen,
        reparar: entrega.reparar,
        dia: entrega.dia,
        correos: registro.correos,
      });
    }
    return { notified, push, correo: correoConfigurado() };
  },
});

/**
 * Cuenta cada respuesta del servicio push. Una respuesta exitosa acepta el
 * mensaje para envío; no confirma que el sistema operativo lo haya mostrado.
 */
async function sendToUser(
  ctx: Pick<ActionCtx, 'runQuery' | 'runMutation'>,
  userId: Id<'users'>,
  payload: Payload,
): Promise<{ intentos: number; entregado: boolean; aceptados: number; fallidos: number; caducados: number }> {
  const subscriptions: Array<{ endpoint: string; authKey: string; p256dhKey: string }> = await ctx.runQuery(internal.notifications.subscriptionsOf, { userId });
  const serialized = JSON.stringify(payload);
  let aceptados = 0;
  let caducados = 0;
  for (const sub of subscriptions) {
    try {
      // `urgency: high` para que Android no lo retrase en reposo, y un día de
      // vida: un aviso de hace más de un día ya lo dice el resumen.
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.authKey, p256dh: sub.p256dhKey } }, serialized, {
        urgency: 'high',
        TTL: 86_400,
        timeout: 10_000,
      });
      aceptados += 1;
    } catch (error) {
      // 404 y 410: la suscripción murió en el navegador o en el servicio de
      // push; se retira para no insistir. Antes sólo se miraba el 410 y una
      // suscripción caducada con 404 se quedaba para siempre sin avisar a nadie.
      const status = error instanceof Error && 'statusCode' in error ? (error as { statusCode: number }).statusCode : null;
      if (status === 404 || status === 410) {
        caducados += 1;
        await ctx.runMutation(internal.notifications.dropSubscription, { endpoint: sub.endpoint });
      } else {
        console.warn(`[avisos] Push rechazado (${status ?? 'sin código'})`);
      }
    }
  }
  return { intentos: subscriptions.length, entregado: aceptados > 0, aceptados, fallidos: subscriptions.length - aceptados, caducados };
}

/**
 * La prueba del botón de Ajustes: un push a cada dispositivo y un correo, y el
 * resultado de cada canal tal cual. Es la forma de saber que los avisos llegan
 * sin esperar a que algo venza.
 */
export const enviarPrueba = internalAction({
  args: { userId: v.id('users') },
  returns: v.object({
    dispositivos: v.number(),
    aceptados: v.number(),
    fallidos: v.number(),
    caducados: v.number(),
    push: v.boolean(),
    pushConfigurado: v.boolean(),
    correo: v.boolean(),
    correoConfigurado: v.boolean(),
  }),
  handler: async (
    ctx,
    { userId },
  ): Promise<{ dispositivos: number; aceptados: number; fallidos: number; caducados: number; push: boolean; pushConfigurado: boolean; correo: boolean; correoConfigurado: boolean }> => {
    const pushConfigurado = vapidConfigured();
    const destino: { email: string } | null = await ctx.runQuery(internal.notifications.destinoDePrueba, { userId });
    const push = pushConfigurado
      ? await sendToUser(ctx, userId, { title: 'Así se ven tus avisos', body: 'Si lees esto en este dispositivo, los recordatorios te llegan.', url: '/settings', tag: 'prueba' })
      : { intentos: 0, entregado: false, aceptados: 0, fallidos: 0, caducados: 0 };
    const correo: boolean =
      correoConfigurado() && destino
        ? await enviarCorreo(destino.email, {
            asunto: 'Así se ven tus avisos',
            texto: 'Si lees esto, los recordatorios por correo te llegan.',
            html: '<p style="font-family:system-ui,sans-serif">Si lees esto, los recordatorios por correo te llegan.</p>',
          })
        : false;
    return { dispositivos: push.intentos, aceptados: push.aceptados, fallidos: push.fallidos, caducados: push.caducados, push: push.entregado, pushConfigurado, correo, correoConfigurado: correoConfigurado() };
  },
});
