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

  it('el ritual con cien tareas cabe en el presupuesto y deja un evento, no cien', async () => {
    const { t, asAna, systemId } = await seed();

    const tareas = await t.run(async (ctx) => {
      const userId = (await ctx.db.query('users').first())!._id;
      const ids = [];
      for (let i = 0; i < 100; i++) {
        ids.push(
          await ctx.db.insert('tasks', {
            userId, systemId, createdBy: userId, createdVia: 'session', title: `Vencida ${i}`,
            status: 'backlog', priority: 'medium', energyLevel: 'medium', inTodayPlan: false, sortIndex: i,
            notifiedBeforeDay: false, notifiedDueDay: false, reminderCount: 0,
            dueDate: Date.parse('2026-01-01T12:00:00Z'), createdAt: 1, updatedAt: 1,
          }),
        );
      }
      return ids;
    });

    // El presupuesto de la restricción 4, como techo. La cifra que vale está en
    // el PR y se midió aparte, con los módulos ya cargados: 46 ms el camino
    // largo, 13 ms este, para las mismas cien asignaciones. Aquí el número
    // incluye el import del módulo, así que sólo sirve para ver que no se
    // dispara; el guardián real de este test es el evento.
    const inicio = Date.now();
    const applied = await asAna.mutation(api.energy.applyWeeklyRitual, {
      assignments: tareas.map((taskId, i) => ({ taskId, date: `2026-09-${String(8 + (i % 5)).padStart(2, '0')}` })),
    });
    const tardo = Date.now() - inicio;

    expect(applied.applied).toHaveLength(100);
    expect(applied.failed).toHaveLength(0);
    expect(tardo).toBeLessThan(10_000);

    const eventos = await t.run((ctx) => ctx.db.query('eventLog').collect());
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.action).toBe('energy.applyWeeklyRitual');
    // Cien fechas anteriores no caben en los 2.048 bytes del payload, así que
    // el reparto grande deja la cuenta y dice que omitió el resto.
    expect(eventos[0]!.payload).toMatchObject({ reprogramadas: 100, anteriorOmitido: true });

    const una = await asAna.query(api.tasks.byId, { id: tareas[0]! });
    expect(una.startDate).not.toBeNull();
  });

  it('un reparto pequeño se lleva las fechas anteriores, para poder deshacerlo', async () => {
    const { t, asAna, systemId } = await seed();
    const task = await asAna.mutation(api.tasks.create, { systemId, title: 'Vencida', dueDate: '2026-01-01T12:00:00Z' });

    await asAna.mutation(api.energy.applyWeeklyRitual, { assignments: [{ taskId: task.id, date: '2026-09-12' }] });

    const eventos = await t.run((ctx) => ctx.db.query('eventLog').collect());
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.payload).toMatchObject({ reprogramadas: 1, anterior: [{ taskId: task.id, startDate: null }] });
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
    expect(found.items.map((r) => r.id)).toContain(critical.id);
  });
});

describe('el techo propuesto al septimo dia', () => {
  const DIA = 86_400_000;

  /**
   * Cierra `cuantos` tareas firmadas por una persona, repartidas en dias
   * distintos, con una hora de trabajo observado cada una.
   */
  async function cerrar(
    t: ReturnType<typeof convexTest>,
    userId: Awaited<ReturnType<typeof seed>>['userId'],
    systemId: Awaited<ReturnType<typeof seed>>['systemId'],
    cuantos: number,
    via: 'session' | 'sync' = 'session',
  ) {
    return t.run(async (ctx) => {
      for (let i = 0; i < cuantos; i++) {
        const cuando = Date.now() - (i % 4) * DIA - 3_600_000;
        const taskId = await ctx.db.insert('tasks', {
          userId, systemId, createdBy: userId, createdVia: 'session',
          title: `Cerrada ${i}`, status: 'done', energyLevel: 'medium', priority: 'medium',
          sortIndex: i, inTodayPlan: false, notifiedBeforeDay: false, notifiedDueDay: false,
          reminderCount: 0, createdAt: 1, updatedAt: 1,
          completedAt: cuando,
          completedBy: via === 'session' ? userId : undefined,
          completedVia: via,
        });
        await ctx.db.insert('timeLogs', {
          userId, taskId, systemId, startedAt: cuando - 3_600_000, endedAt: cuando,
          durationMinutes: 60, source: 'timer', createdAt: cuando,
        });
      }
      return null;
    });
  }

  it('con seis cierres firmados no se emite nada, con siete si', async () => {
    const { t, asAna, userId, systemId } = await seed();

    await cerrar(t, userId, systemId, 6);
    expect(await asAna.query(api.today.interruption, {})).toBeNull();

    await cerrar(t, userId, systemId, 1);
    expect(await asAna.query(api.today.interruption, {})).toMatchObject({ kind: 'techo' });
  });

  it('los cierres de la sincronizacion no cuentan: no los cerro una persona', async () => {
    const { t, asAna, userId, systemId } = await seed();
    // Nueve cierres, pero ninguno con persona detras.
    await cerrar(t, userId, systemId, 9, 'sync');
    expect(await asAna.query(api.today.interruption, {})).toBeNull();
  });

  it('la propuesta sale de las filas reales y trae su evidencia', async () => {
    const { t, asAna, userId, systemId } = await seed();
    await cerrar(t, userId, systemId, 8);

    const linea = (await asAna.query(api.today.interruption, {}))!;
    expect(linea.payload).toMatchObject({ cierres: 8, dias: 4, horasObservadas: 8, actual: 8 });
    // Ocho horas observadas en cuatro dias: dos horas al dia, no las ocho que
    // el perfil tenia puestas.
    expect(linea.payload.propuesto).toBe(2);
    expect((linea.payload.evidencia as string[]).length).toBe(8);
  });

  it('aceptarla escribe el techo y deja un evento con el valor anterior', async () => {
    const { t, asAna, userId, systemId } = await seed();
    await cerrar(t, userId, systemId, 8);

    const resultado = await asAna.mutation(api.energy.applyCeiling, { horas: 2 });
    expect(resultado).toEqual({ anterior: 8, horas: 2 });

    const perfil = await t.run((ctx) => ctx.db.query('userEnergyProfile').first());
    expect(perfil!.availableHoursPerDay).toBe(2);

    const eventos = await t.run((ctx) => ctx.db.query('eventLog').collect());
    const evento = eventos.find((e) => e.action === 'energy.applyCeiling')!;
    // El valor anterior viaja en el evento: eso es lo que hace el deshacer.
    expect(evento.payload).toEqual({ anterior: 8, horas: 2 });
  });

  it('proponer el techo que ya tiene es no proponer nada', async () => {
    const { t, asAna, userId, systemId } = await seed();
    await cerrar(t, userId, systemId, 8);
    await asAna.mutation(api.energy.applyCeiling, { horas: 2 });
    expect(await asAna.query(api.today.interruption, {})).toBeNull();
  });

  it('descartarla la retira y no vuelve', async () => {
    const { t, asAna, userId, systemId } = await seed();
    await cerrar(t, userId, systemId, 8);
    const linea = (await asAna.query(api.today.interruption, {}))!;

    await asAna.mutation(api.today.acknowledge, { kind: 'techo', key: linea.key });
    expect(await asAna.query(api.today.interruption, {})).toBeNull();
  });

  it('el techo de una persona no se propone desde la cuenta de otra', async () => {
    const { t, asAna, userId, systemId } = await seed();
    await cerrar(t, userId, systemId, 8);

    const beto = t.withIdentity({ subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' });
    await beto.mutation(api.users.ensure, {});
    expect(await beto.query(api.today.interruption, {})).toBeNull();
    expect(await asAna.query(api.today.interruption, {})).not.toBeNull();
  });
});
