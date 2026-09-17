import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery, type QueryCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { reportStaleCrons, withCronRun } from './cronRuns';
import { nightlyRefresh } from './energy';
import { calendarDayInTz, userToday } from './lib/time';

// Las dos tareas programadas de `convex/crons.ts`. Cada una es una acción que
// deja su ejecución en `cronRuns` y reparte el trabajo en mutaciones pequeñas:
// un usuario que falle no se lleva por delante a los demás, y ninguna
// transacción lee más de lo que cabe en una.

const MAX_USERS_PER_RUN = 50;

/**
 * Presupuesto de lectura por día candidato.
 *
 * **No sale de `MAX_USERS_PER_RUN`, y no puede salir de ahí.** Un día candidato
 * no contiene sólo a quien está viviendo ese día: contiene también el check-in
 * de ayer de quien ya pasó al siguiente, y esas filas ocupan sitio sin ser
 * candidatas. Atarlo al tope de personas dejaba fuera a un activo de verdad en
 * cuanto los check-in de ayer de otra zona llenaban el cupo antes que él.
 *
 * Sale de acotar la consulta y nada más: mil filas por día, tres días como
 * mucho, muy por debajo de lo que aguanta una transacción de Convex, y a tres
 * slots por persona cubre más de trescientas personas activas por día.
 *
 * Por encima, la vuelta se queda con los primeros `userId` de ese día y el resto
 * se queda sin snapshot ese día. Es la única frontera de esta lectura y es la
 * misma forma que tenía `MAX_USERS_PER_RUN`: mejor esfuerzo, no garantía.
 */
const MAX_CHECKINS_POR_DIA = 1_000;

const HORA_MS = 3_600_000;

/**
 * Los días que ahora mismo son "hoy" para alguien en el mundo. Las zonas van de
 * UTC-12 a UTC+14, veintiséis horas de ancho, así que en un instante dado hay
 * como mucho tres fechas locales distintas y la del propio UTC siempre queda en
 * medio.
 */
function diasPosibles(now: number): string[] {
  const dias = [now - 12 * HORA_MS, now, now + 14 * HORA_MS].map((instante) => calendarDayInTz(instante, 'UTC'));
  return [...new Set(dias)];
}

/**
 * Quién hizo check-in hoy, en su propia zona: el snapshot sólo vale para quien
 * usó la app.
 *
 * La señal de "activo" es el check-in, no `lastActiveAt`, así que la lectura
 * entra por `energyCheckins`, que es donde vive, y no por `users`, que había
 * que recorrer entera para descartar a casi todo el mundo. Acotar `users` por
 * un índice de actividad habría acotado la lectura con **otra** definición de
 * activo, y cambiarla es una decisión de producto, no un ajuste de lectura.
 *
 * El día de un check-in está escrito en la zona de quien lo hizo, así que la
 * consulta pide los días que ahora mismo son hoy en alguna zona y confirma cada
 * candidato contra la zona de su dueño: un check-in del 16 leído desde una zona
 * donde todavía es 15 se descarta. Descartar cuesta leer, y por eso el
 * presupuesto de lectura se cuenta en filas y no en personas.
 *
 * El conjunto que sale es el mismo que salía de recorrer `users` **con dos
 * condiciones**: que haya como mucho `MAX_USERS_PER_RUN` personas activas, y
 * que ningún día candidato tenga más de `MAX_CHECKINS_POR_DIA` check-in. Si
 * falla la primera cambia cuáles entran, porque el orden ya no es el de
 * creación de la cuenta; si falla la segunda puede faltar alguien que sí estaba
 * activo. Las dos están escritas donde vive cada número.
 */
export async function activosHoy(ctx: QueryCtx, now: number): Promise<Id<'users'>[]> {
  const activos: Id<'users'>[] = [];
  const elegidos = new Set<Id<'users'>>();
  /** La zona de cada dueño se resuelve una vez, aunque tenga varios check-in. */
  const hoyDe = new Map<Id<'users'>, string | null>();
  for (const dia of diasPosibles(now)) {
    const checkins = await ctx.db
      .query('energyCheckins')
      .withIndex('by_day_user', (q) => q.eq('date', dia))
      .take(MAX_CHECKINS_POR_DIA);
    for (const checkin of checkins) {
      if (elegidos.has(checkin.userId)) continue;
      let hoy = hoyDe.get(checkin.userId);
      if (hoy === undefined) {
        const user = await ctx.db.get(checkin.userId);
        hoy = user ? userToday(user.timezone, now) : null;
        hoyDe.set(checkin.userId, hoy);
      }
      if (hoy !== dia) continue;
      elegidos.add(checkin.userId);
      activos.push(checkin.userId);
      if (activos.length >= MAX_USERS_PER_RUN) return activos;
    }
  }
  return activos;
}

export const activeUserIds = internalQuery({
  args: {},
  returns: v.array(v.id('users')),
  handler: (ctx) => activosHoy(ctx, Date.now()),
});

export const refreshUser = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (user) await nightlyRefresh(ctx, user);
    return null;
  },
});

/**
 * Snapshot de comportamiento y recalibración para cada persona activa hoy.
 * Como es el cron que corre seguro una vez al día, también vigila la bitácora
 * y la poda; las dos cosas van después del trabajo de verdad.
 */
export const dailySnapshot = internalAction({
  args: {},
  handler: async (ctx) => {
    return withCronRun(ctx, 'daily-snapshot', async () => {
      const userIds: Id<'users'>[] = await ctx.runQuery(internal.scheduler.activeUserIds, {});
      let processed = 0;
      let failed = 0;
      for (const userId of userIds) {
        try {
          await ctx.runMutation(internal.scheduler.refreshUser, { userId });
          processed += 1;
        } catch (error) {
          failed += 1;
          console.error(`[cron] daily-snapshot falló para ${userId}:`, error);
        }
      }
      const staleCrons = (await reportStaleCrons(ctx)).map((cron) => cron.job);
      let prunedCronRuns = 0;
      try {
        prunedCronRuns = await ctx.runMutation(internal.cronRuns.prune, {});
      } catch (error) {
        console.error('[cron] no se pudo podar la bitácora:', error);
      }
      return { processed, failed, prunedCronRuns, staleCrons };
    });
  },
});

/** Los push de vencimientos, recordatorios y escaladas; el envío vive en `pushSend.ts`. */
export const taskReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    return withCronRun(ctx, 'task-reminders', async () => {
      // El envío corre en Node por `web-push`; cruzar de runtime es el caso en
      // que una acción sí llama a otra.
      const result: { notified: number } = await ctx.runAction(internal.pushSend.sendTaskReminders, {});
      return result;
    });
  },
});
