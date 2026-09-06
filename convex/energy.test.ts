import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

async function seed() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const systemId = await t.run(async (ctx) => {
    await ctx.db.insert('userEnergyProfile', {
      userId, chronotype: 'morning', sleepTypicalHours: 7, availableHoursPerDay: 8, energyFloor: 20,
      rechargePresets: [], learnedCurve: [], learningAlpha: 0, createdAt: 1, updatedAt: 1,
    });
    await ctx.db.insert('userSettings', {
      userId, onboardingVersion: 1, weeklyReviewDay: 'sun', dailyResetTime: '00:00', dailyEnergyLimit: 50,
      focusTimeoutHours: 3, theme: 'system', notificationsEnabled: true, createdAt: 1, updatedAt: 1,
    });
    return ctx.db.insert('systems', { userId, createdBy: userId, createdVia: 'session', name: 'Kino', color: 'blue', templateType: 'project', icon: 'x', isActive: true, isInbox: false, sortOrder: 0, createdAt: 1, updatedAt: 1 });
  });
  return { t, asAna, userId, systemId };
}

describe('energy', () => {
  it('la predicción se escribe antes del check-in y el check-in la verifica', async () => {
    const { asAna } = await seed();
    await asAna.mutation(api.energy.ensureTodayPredictions, {});
    const plan = await asAna.query(api.energy.todayPlan, {});
    expect(plan.predictions).toHaveLength(3);
    expect(plan.hasCheckin).toBe(false);
    expect(plan.projectedCurve).toHaveLength(24);

    const checkin = await asAna.mutation(api.energy.createCheckin, { currentLevel: 70, sleepQuality: 'good', slot: 'morning' });
    expect(checkin.slot).toBe('morning');
    const again = await asAna.mutation(api.energy.createCheckin, { currentLevel: 40, slot: 'morning' });
    expect(again.id).toBe(checkin.id);
    expect((await asAna.query(api.energy.checkins, {})).map((c) => c.currentLevel)).toEqual([40]);

    const insight = await asAna.query(api.energy.learningInsight, {});
    expect(insight.loop?.slot).toBe('morning');
    expect(insight.chronotype).toBe('morning');
  });

  it('las ventanas leen la curva del cronotipo y el presupuesto de hoy', async () => {
    const { asAna, systemId } = await seed();
    await asAna.mutation(api.tasks.create, { systemId, title: 'Dura', energyLevel: 'high', startDate: new Date().toISOString() });
    const windows = await asAna.query(api.energy.windows, {});
    expect(windows.hasLearnedCurve).toBe(false);
    expect(windows.slots.map((s) => s.slot)).toEqual(['morning', 'afternoon', 'evening']);
    expect(windows.budget.committed).toBe(5);
  });

  it('colocar un bloque escribe la fecha de inicio y el ritual reparte lo vencido', async () => {
    const { asAna, systemId } = await seed();
    const task = await asAna.mutation(api.tasks.create, { systemId, title: 'Bloque', energyLevel: 'medium' });
    const block = await asAna.mutation(api.energy.scheduleBlock, { taskId: task.id, date: '2026-09-10', hour: 9 });
    expect(block.fit.verdict).toBeDefined();
    expect((await asAna.query(api.tasks.byId, { id: task.id })).status).toBe('week');

    const overdue = await asAna.mutation(api.tasks.create, { systemId, title: 'Vencida', dueDate: '2026-01-01T12:00:00Z' });
    const ritual = await asAna.query(api.energy.weeklyRitual, {});
    expect(ritual.overdueCount).toBe(1);
    const applied = await asAna.mutation(api.energy.applyWeeklyRitual, { assignments: [{ taskId: overdue.id, date: '2026-09-12' }] });
    expect(applied.applied).toHaveLength(1);
    expect(applied.failed).toHaveLength(0);
  });

  it('insights: sugiere por importancia y clasifica por palabras del sistema', async () => {
    const { asAna, systemId } = await seed();
    await asAna.mutation(api.tasks.create, { systemId, title: 'Baja', priority: 'low', startDate: new Date().toISOString() });
    const critical = await asAna.mutation(api.tasks.create, { systemId, title: 'Crítica', priority: 'critical', startDate: new Date().toISOString() });
    const suggested = await asAna.query(api.insights.suggest, { limit: 5 });
    expect(suggested[0].id).toBe(critical.id);
    expect(suggested[0].why).toContain('prioridad crítica');
    const classified = await asAna.query(api.insights.classify, { title: 'Arreglar Kino urgente' });
    expect(classified).toMatchObject({ systemId, suggestedPriority: 'critical' });
    const found = await asAna.query(api.search.all, { q: 'critica' });
    expect(found.map((r) => r.id)).toContain(critical.id);
  });
});
