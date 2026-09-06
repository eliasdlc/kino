import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

async function seed() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const systemId = await t.run(async (ctx) => {
    await ctx.db.insert('userSettings', {
      userId,
      onboardingVersion: 1,
      weeklyReviewDay: 'sun',
      dailyResetTime: '00:00',
      dailyEnergyLimit: 50,
      focusTimeoutHours: 3,
      theme: 'system',
      notificationsEnabled: true,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert('systemStatusDefinitions', { systemType: 'project', statusName: 'todo', label: 'Por hacer', position: 0 });
    await ctx.db.insert('systemStatusDefinitions', { systemType: 'project', statusName: 'done', label: 'Hecho', position: 1 });
    return ctx.db.insert('systems', {
      userId,
      createdBy: userId,
      createdVia: 'session',
      name: 'Kino',
      color: 'blue',
      templateType: 'project',
      icon: 'rocket',
      isActive: true,
      isInbox: false,
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
    });
  });
  return { t, asAna, userId, systemId };
}

describe('tasks', () => {
  it('crea con estado derivado de la fecha de inicio y lo pone en el plan de hoy', async () => {
    const { asAna, systemId } = await seed();
    const task = await asAna.mutation(api.tasks.create, {
      systemId,
      title: 'Escribir la escena del puente',
      startDate: new Date().toISOString(),
      priority: 'critical',
      dueDate: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    });
    expect(task.status).toBe('today');
    expect(task.inTodayPlan).toBe(true);
    expect(await asAna.query(api.tasks.todayPlan, {})).toMatchObject([{ id: task.id }]);
    const reminders = await asAna.query(api.tasks.timeLogSummary, { id: task.id });
    expect(reminders).toEqual({ totalMinutes: 0, sessionCount: 0 });
  });

  it('la búsqueda lematizada encuentra "escribiendo" en "Escribir la escena del puente"', async () => {
    const { asAna, systemId } = await seed();
    const task = await asAna.mutation(api.tasks.create, { systemId, title: 'Escribir la escena del puente' });
    await asAna.mutation(api.tasks.create, { systemId, title: 'Comprar café' });
    const found = await asAna.query(api.tasks.search, { query: 'escribiendo' });
    expect(found.map((item) => item.id)).toEqual([task.id]);
  });

  it('la máquina de estados: toggle completa, undo vuelve a hoy, y un salto inválido se rechaza', async () => {
    const { asAna, systemId } = await seed();
    const task = await asAna.mutation(api.tasks.create, { systemId, title: 'Una' });
    expect(await asAna.mutation(api.tasks.toggle, { id: task.id })).toEqual({ status: 'done' });
    expect(await asAna.mutation(api.tasks.toggle, { id: task.id })).toEqual({ status: 'today' });
    await asAna.mutation(api.tasks.move, { id: task.id, status: 'week' });
    await expect(asAna.mutation(api.tasks.move, { id: task.id, status: 'done' })).resolves.toMatchObject({ status: 'done' });
    // Desde hecho sólo se puede deshacer, no mover a mañana.
    await expect(asAna.mutation(api.tasks.move, { id: task.id, status: 'tomorrow' })).rejects.toThrow();
  });

  it('completar una recurrente siembra la siguiente una sola vez', async () => {
    const { asAna, systemId } = await seed();
    const due = new Date('2026-09-07T12:00:00Z').toISOString();
    const task = await asAna.mutation(api.tasks.create, {
      systemId,
      title: 'Regar',
      dueDate: due,
      recurrenceRule: 'FREQ=WEEKLY',
    });
    await asAna.mutation(api.tasks.toggle, { id: task.id });
    await asAna.mutation(api.tasks.toggle, { id: task.id });
    await asAna.mutation(api.tasks.toggle, { id: task.id });
    const all = await asAna.query(api.tasks.bySystem, { systemId });
    const next = all.filter((item) => item.recurrenceParentId === task.id);
    expect(next).toHaveLength(1);
    expect(next[0].dueDate).toBe(new Date('2026-09-14T12:00:00Z').toISOString());
  });

  it('reordena por posición e ignora ids ajenos', async () => {
    const { t, asAna, systemId } = await seed();
    const a = await asAna.mutation(api.tasks.create, { systemId, title: 'A' });
    const b = await asAna.mutation(api.tasks.create, { systemId, title: 'B' });
    const bob = t.withIdentity({ subject: 'user_bob', email: 'bob@usekino.dev' });
    const bobSystem = await t.run(async (ctx) => {
      const bobId = await ctx.db.insert('users', { clerkId: 'user_bob', email: 'bob@usekino.dev', name: 'Bob', onboardingCompleted: true, status: 'active', timezone: 'UTC', createdAt: 1, updatedAt: 1 });
      return ctx.db.insert('systems', { userId: bobId, createdBy: bobId, createdVia: 'session', name: 'Bob', color: 'red', templateType: 'custom', icon: 'x', isActive: true, isInbox: false, sortOrder: 0, createdAt: 1, updatedAt: 1 });
    });
    const foreign = await bob.mutation(api.tasks.create, { systemId: bobSystem, title: 'De Bob' });

    await asAna.mutation(api.tasks.reorder, { ids: [b.id, foreign.id, a.id] });
    const ordered = await asAna.query(api.tasks.bySystem, { systemId });
    expect(ordered.map((item) => item.title)).toEqual(['B', 'A']);
    expect((await bob.query(api.tasks.byId, { id: foreign.id })).sortIndex).toBe(0);
  });

  it('el tablero: la columna terminal completa la tarea y una columna inexistente se rechaza', async () => {
    const { asAna, systemId } = await seed();
    const task = await asAna.mutation(api.tasks.create, { systemId, title: 'Tarjeta', boardStatus: 'todo' });
    const moved = await asAna.mutation(api.tasks.moveBoard, { id: task.id, boardStatus: 'done' });
    expect(moved).toMatchObject({ boardStatus: 'done', status: 'done' });
    await expect(asAna.mutation(api.tasks.moveBoard, { id: task.id, boardStatus: 'nope' })).rejects.toThrow();
  });

  it('el rollover del plan repuebla con lo que empieza hoy y no repite en el día', async () => {
    const { t, asAna, systemId, userId } = await seed();
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const stale = await asAna.mutation(api.tasks.create, { systemId, title: 'Ayer', startDate: yesterday });
    await t.run(async (ctx) => {
      await ctx.db.patch(stale.id as Id<'tasks'>, { inTodayPlan: true, status: 'today' });
      const settings = await ctx.db.query('userSettings').withIndex('by_user', (q) => q.eq('userId', userId)).unique();
      await ctx.db.patch(settings!._id, { todayPlanDate: '2020-01-01' });
    });
    const today = await asAna.mutation(api.tasks.create, { systemId, title: 'Hoy', startDate: new Date().toISOString() });

    expect(await asAna.mutation(api.tasks.rollTodayPlan, {})).toEqual({ rolled: true });
    const plan = await asAna.query(api.tasks.todayPlan, {});
    expect(plan.map((item) => item.id)).toEqual([today.id]);
    expect((await asAna.query(api.tasks.byId, { id: stale.id })).status).toBe('week');
    expect(await asAna.mutation(api.tasks.rollTodayPlan, {})).toEqual({ rolled: false });
  });

  it('borrar es papelera, restaurar la saca, y la misma petición offline no duplica', async () => {
    const { asAna, systemId } = await seed();
    const first = await asAna.mutation(api.tasks.create, { systemId, title: 'Una', clientRequestId: 'req-1' });
    const again = await asAna.mutation(api.tasks.create, { systemId, title: 'Una', clientRequestId: 'req-1' });
    expect(again.id).toBe(first.id);
    await asAna.mutation(api.tasks.remove, { id: first.id });
    expect(await asAna.query(api.tasks.list, {})).toEqual([]);
    expect((await asAna.query(api.tasks.list, { deleted: true })).map((i) => i.id)).toEqual([first.id]);
    await asAna.mutation(api.tasks.restore, { id: first.id });
    expect((await asAna.query(api.tasks.list, {})).map((i) => i.id)).toEqual([first.id]);
  });
});

describe('metadata de tarea', () => {
  async function academicSystem() {
    const { t, asAna, userId } = await seed();
    const systemId = await t.run((ctx) =>
      ctx.db.insert('systems', {
        userId, name: 'Semestre', color: 'green', templateType: 'academic', icon: 'book', isActive: true, isInbox: false, sortOrder: 1, createdAt: 1, updatedAt: 1,
        createdBy: userId,
        createdVia: 'session',
      }),
    );
    return { asAna, systemId };
  }

  it('acepta el kind del manifiesto junto a otras claves libres', async () => {
    const { asAna, systemId } = await academicSystem();
    const task = await asAna.mutation(api.tasks.create, { systemId, title: 'Entrega 1', metadata: { kind: 'assignment', course: 'Redes' } });
    expect(task.metadata).toEqual({ kind: 'assignment', course: 'Redes' });
  });

  it('rechaza un kind que el sistema no define y un eventSubtype inventado', async () => {
    const { asAna, systemId } = await academicSystem();
    await expect(asAna.mutation(api.tasks.create, { systemId, title: 'x', metadata: { kind: 'sprint' } })).rejects.toThrow();
    await expect(asAna.mutation(api.tasks.create, { systemId, title: 'x', metadata: { eventSubtype: 'party' } })).rejects.toThrow();
  });
});
