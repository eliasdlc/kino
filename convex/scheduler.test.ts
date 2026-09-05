import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import crons from './crons';
import schema from './schema';
import { userToday } from './lib/time';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const bea = { subject: 'user_bea', email: 'bea@usekino.dev', name: 'Bea' };
const DAY_MS = 86_400_000;

async function seed() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const anaId = await asAna.mutation(api.users.ensure, {});
  const beaId = await t.withIdentity(bea).mutation(api.users.ensure, {});
  await t.run(async (ctx) => {
    for (const userId of [anaId, beaId]) {
      await ctx.db.insert('userEnergyProfile', {
        userId, chronotype: 'morning', sleepTypicalHours: 7, availableHoursPerDay: 8, energyFloor: 20,
        rechargePresets: [], learnedCurve: [], learningAlpha: 0, createdAt: 1, updatedAt: 1,
      });
    }
  });
  return { t, asAna, anaId, beaId };
}

describe('crons', () => {
  it('registra las dos tareas con su cadencia', () => {
    const registered = JSON.parse(crons.export()) as Record<string, { schedule: { type: string } }>;
    expect(Object.keys(registered).sort()).toEqual(['daily-snapshot', 'task-reminders']);
    expect(registered['daily-snapshot']!.schedule.type).toBe('daily');
    expect(registered['task-reminders']!.schedule.type).toBe('interval');
  });
});

describe('daily-snapshot', () => {
  it('sólo toca a quien hizo check-in hoy, y deja constancia en la bitácora', async () => {
    const { t, asAna, anaId, beaId } = await seed();
    await asAna.mutation(api.energy.createCheckin, { currentLevel: 70, slot: 'morning' });

    const result = await t.action(internal.scheduler.dailySnapshot, {});
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    // Su propia fila sigue abierta mientras vigila, así que la primera vuelta se
    // cuenta a sí misma como ausente; los recordatorios aún no han corrido nunca.
    expect(result.staleCrons).toEqual(['daily-snapshot', 'task-reminders']);

    const tz = (await t.run((ctx) => ctx.db.get(anaId)))!.timezone;
    const yesterday = userToday(tz, Date.now() - DAY_MS);
    const snapshots = await t.run((ctx) => ctx.db.query('behaviorSnapshots').collect());
    expect(snapshots.map((s) => [s.userId, s.date])).toEqual([[anaId, yesterday]]);
    expect(snapshots.some((s) => s.userId === beaId)).toBe(false);

    const runs = await t.run((ctx) => ctx.db.query('cronRuns').collect());
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ job: 'daily-snapshot', ok: true, result: { processed: 1 } });
    expect(runs[0]!.finishedAt).toBeDefined();
  });

  it('la segunda vuelta no duplica el snapshot y poda lo de hace más de un mes', async () => {
    const { t, asAna } = await seed();
    await asAna.mutation(api.energy.createCheckin, { currentLevel: 70, slot: 'morning' });
    await t.run(async (ctx) => {
      await ctx.db.insert('cronRuns', { job: 'task-reminders', startedAt: Date.now() - 40 * DAY_MS, finishedAt: Date.now() - 40 * DAY_MS, ok: true });
    });

    const first = await t.action(internal.scheduler.dailySnapshot, {});
    expect(first.prunedCronRuns).toBe(1);
    const second = await t.action(internal.scheduler.dailySnapshot, {});
    expect(second.processed).toBe(1);
    expect(second.prunedCronRuns).toBe(0);
    // Con la primera vuelta ya cerrada en verde, sólo los recordatorios siguen callados.
    expect(second.staleCrons).toEqual(['task-reminders']);
    expect(await t.run((ctx) => ctx.db.query('behaviorSnapshots').collect())).toHaveLength(1);
    expect((await t.run((ctx) => ctx.db.query('cronRuns').collect())).map((r) => r.job)).toEqual(['daily-snapshot', 'daily-snapshot']);
  });
});

describe('cronRuns', () => {
  it('una ejecución que falla queda cerrada con su error y no cuenta como éxito', async () => {
    const { t } = await seed();
    const id = await t.mutation(internal.cronRuns.open, { job: 'task-reminders' });
    await t.mutation(internal.cronRuns.close, { id, ok: false, error: 'boom' });
    const last = await t.query(internal.cronRuns.lastSuccesses, {});
    expect(last).toEqual([
      { job: 'daily-snapshot', at: null },
      { job: 'task-reminders', at: null },
    ]);
    expect((await t.run((ctx) => ctx.db.get(id)))!.error).toBe('boom');
  });
});
