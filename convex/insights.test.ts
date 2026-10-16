import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { estimateTaskAttributes, toStaleSystemRows } from './insights';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 7, 11, 30); // 11:30 en UTC: tramo de la mañana

async function seed() {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const t = convexTest(schema, modules);
  const as = t.withIdentity(ana);
  const userId = (await as.mutation(api.users.ensure, {})) as Id<'users'>;
  await t.run((ctx) => ctx.db.patch(userId, { timezone: 'UTC' }));
  const system = await as.mutation(api.systems.create, { name: 'Kino', color: 'blue', templateType: 'project', icon: 'rocket' });
  return { t, as, userId, systemId: system.id as Id<'systems'> };
}

describe('insights', () => {
  afterEach(() => vi.useRealTimers());

  it('suggest suma vencimiento, prioridad, cercanía, encaje de energía y antigüedad con tope', async () => {
    const { t, as, systemId } = await seed();
    const due = (days: number) => new Date(NOW + days * DAY).toISOString();
    const base = { systemId, status: 'today' as const };
    const low = await as.mutation(api.tasks.create, { ...base, title: 'Baja', priority: 'low', energyLevel: 'medium' });
    await as.mutation(api.tasks.create, { ...base, title: 'Alta mañana', priority: 'high', energyLevel: 'high', dueDate: due(1) });
    await as.mutation(api.tasks.create, { ...base, title: 'Vencida', priority: 'medium', energyLevel: 'low', dueDate: due(-1) });
    await as.mutation(api.tasks.create, { ...base, title: 'Crítica', priority: 'critical', energyLevel: 'medium', dueDate: due(2) });
    await as.mutation(api.tasks.create, { ...base, title: 'En una semana', priority: 'low', energyLevel: 'low', dueDate: due(7) });
    // Veinte días de antigüedad cuentan como catorce: 14 × 4 = 56.
    await t.run((ctx) => ctx.db.patch(low.id as Id<'tasks'>, { createdAt: NOW - 20 * DAY }));

    const ranked = await as.query(api.insights.suggest, {});
    // Sin check-in ni perfil la banda es media.
    expect(ranked.map((r) => [r.title, r.importanceScore, r.energyBand])).toEqual([
      ['Vencida', 1000 + 200 + 150 + 60, 'medium'],
      ['Crítica', 400 + 150 + 120, 'medium'],
      ['Alta mañana', 300 + 150 + 60, 'medium'],
      ['Baja', 100 + 120 + 56, 'medium'],
      ['En una semana', 100 + 75 + 60, 'medium'],
    ]);
    expect(ranked[0]!.why).toBe('vencida, planeada para hoy');
  });

  it('levelToBand corta en 65 y en 35 con el check-in del tramo actual', async () => {
    const { t, as, userId, systemId } = await seed();
    await as.mutation(api.tasks.create, { systemId, status: 'today', title: 'Algo' });
    const checkinId = await t.run((ctx) =>
      ctx.db.insert('energyCheckins', { userId, date: '2026-10-07', slot: 'morning', currentLevel: 0, sleepQuality: 'good', createdAt: NOW }),
    );
    const bandAt = async (currentLevel: number) => {
      await t.run((ctx) => ctx.db.patch(checkinId, { currentLevel }));
      return (await as.query(api.insights.suggest, {}))[0]!.energyBand;
    };
    expect(await bandAt(65)).toBe('high');
    expect(await bandAt(64)).toBe('medium');
    expect(await bandAt(35)).toBe('medium');
    expect(await bandAt(34)).toBe('low');
  });

  it('slotForHour: la mañana va de 6 a 12 y la noche cubre la madrugada', async () => {
    const { t, as, userId, systemId } = await seed();
    await as.mutation(api.tasks.create, { systemId, status: 'today', title: 'Algo' });
    await t.run((ctx) =>
      ctx.db.insert('energyCheckins', { userId, date: '2026-10-07', slot: 'morning', currentLevel: 90, sleepQuality: 'good', createdAt: NOW }),
    );
    // Sólo cuenta el check-in del tramo de la hora actual; fuera de él, sin
    // perfil, la banda vuelve a media.
    const bandAt = async (hour: number, minute: number) => {
      vi.setSystemTime(Date.UTC(2026, 9, 7, hour, minute));
      return (await as.query(api.insights.suggest, {}))[0]!.energyBand;
    };
    expect(await bandAt(5, 59)).toBe('medium');
    expect(await bandAt(6, 0)).toBe('high');
    expect(await bandAt(11, 59)).toBe('high');
    expect(await bandAt(12, 0)).toBe('medium');
  });

  it('TIME_KEYWORDS: gana la primera palabra de la tabla, sin acentos, y por defecto media hora', () => {
    expect(estimateTaskAttributes('Quick deploy review').estimatedTime).toBe('00:15:00');
    expect(estimateTaskAttributes('Investigar el mercado').estimatedTime).toBe('01:30:00');
    expect(estimateTaskAttributes('Reunion de equipo').estimatedTime).toBe('01:00:00');
    expect(estimateTaskAttributes('Comprar pan').estimatedTime).toBe('00:30:00');
  });

  it('staleSystems mide desde la última actividad, o desde la creación si no la hay', () => {
    const daysAgo = (n: number) => new Date(NOW - n * DAY);
    const rows = toStaleSystemRows(
      [
        { systemId: 'nunca', systemName: 'Nunca', createdAt: daysAgo(30), lastCompletedAt: null, lastLogAt: null },
        { systemId: 'activo', systemName: 'Activo', createdAt: daysAgo(100), lastCompletedAt: daysAgo(3).toISOString(), lastLogAt: daysAgo(20).toISOString() },
        { systemId: 'nuevo', systemName: 'Nuevo', createdAt: daysAgo(5), lastCompletedAt: null, lastLogAt: null },
        { systemId: 'parado', systemName: 'Parado', createdAt: daysAgo(60), lastCompletedAt: null, lastLogAt: daysAgo(15).toISOString() },
      ],
      14,
      NOW,
    );
    expect(rows).toEqual([
      { systemId: 'nunca', systemName: 'Nunca', daysSinceActivity: 30 },
      { systemId: 'parado', systemName: 'Parado', daysSinceActivity: 15 },
    ]);
  });

  it('staleSystems deja fuera el Inbox', async () => {
    const { t, as, systemId } = await seed();
    await as.mutation(api.systems.setup, {});
    await t.run(async (ctx) => {
      for (const system of await ctx.db.query('systems').collect()) await ctx.db.patch(system._id, { createdAt: NOW - 20 * DAY });
    });
    const stale = await as.query(api.insights.staleSystems, { days: 14 });
    expect(stale).toEqual([{ systemId, systemName: 'Kino', daysSinceActivity: 20 }]);
  });

  it('decompose acota las subtareas pedidas entre dos y ocho', async () => {
    const { as, systemId } = await seed();
    const task = await as.mutation(api.tasks.create, { systemId, status: 'today', title: 'Grande' });
    const taskId = task.id as Id<'tasks'>;
    const countFor = async (count?: number) => (await as.query(api.insights.decompose, { taskId, count })).count;
    expect(await countFor()).toBe(3);
    expect(await countFor(1)).toBe(2);
    expect(await countFor(-5)).toBe(2);
    expect(await countFor(20)).toBe(8);
    expect(await countFor(3.9)).toBe(3);
  });
});
