import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { reportStaleCrons, withCronRun } from './cronRuns';
import { nightlyRefresh } from './energy';
import { userToday } from './lib/time';

// Las dos tareas programadas de `convex/crons.ts`. Cada una es una acción que
// deja su ejecución en `cronRuns` y reparte el trabajo en mutaciones pequeñas:
// un usuario que falle no se lleva por delante a los demás, y ninguna
// transacción lee más de lo que cabe en una.

const MAX_USERS_PER_RUN = 50;

/** Quién hizo check-in hoy, en su propia zona: el snapshot sólo vale para quien usó la app. */
export const activeUserIds = internalQuery({
  args: {},
  returns: v.array(v.id('users')),
  handler: async (ctx) => {
    const now = Date.now();
    const users = await ctx.db.query('users').collect();
    const active: Id<'users'>[] = [];
    for (const user of users) {
      const checkin = await ctx.db
        .query('energyCheckins')
        .withIndex('by_user_day_slot', (q) => q.eq('userId', user._id).eq('date', userToday(user.timezone, now)))
        .first();
      if (checkin) active.push(user._id);
      if (active.length >= MAX_USERS_PER_RUN) break;
    }
    return active;
  },
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
