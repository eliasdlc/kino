import { convexTest } from 'convex-test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const NOW = Date.UTC(2026, 9, 7, 15);

async function seed() {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const t = convexTest(schema, modules);
  const as = t.withIdentity(ana);
  await as.mutation(api.users.ensure, {});
  const system = await as.mutation(api.systems.create, { name: 'Kino', color: 'blue', templateType: 'project', icon: 'rocket' });
  return { as, systemId: system.id };
}

describe('sprints', () => {
  afterEach(() => vi.useRealTimers());

  it('completar fija completedAt y reabrir lo borra', async () => {
    const { as, systemId } = await seed();
    const sprint = await as.mutation(api.sprints.create, { systemId, name: 'Sprint 1' });
    expect(sprint).toMatchObject({ status: 'active', completedAt: null });

    vi.setSystemTime(NOW + 60_000);
    const done = await as.mutation(api.sprints.update, { id: sprint.id, status: 'completed' });
    expect(done).toMatchObject({ status: 'completed', completedAt: new Date(NOW + 60_000).toISOString() });

    const reopened = await as.mutation(api.sprints.update, { id: sprint.id, status: 'active' });
    expect(reopened).toMatchObject({ status: 'active', completedAt: null });

    vi.setSystemTime(NOW + 120_000);
    const closed = await as.mutation(api.sprints.close, { id: sprint.id });
    expect(closed).toMatchObject({ status: 'completed', completedAt: new Date(NOW + 120_000).toISOString() });
  });

  it('una fecha nula la borra en vez de guardar NaN, y una fecha que no se lee se rechaza', async () => {
    const { as, systemId } = await seed();
    const sprint = await as.mutation(api.sprints.create, { systemId, name: 'Sprint 1', startDate: '2026-10-01', endDate: '2026-10-14' });
    expect(sprint).toMatchObject({ startDate: '2026-10-01T00:00:00.000Z', endDate: '2026-10-14T00:00:00.000Z' });

    const cleared = await as.mutation(api.sprints.update, { id: sprint.id, startDate: null, endDate: null });
    expect(cleared).toMatchObject({ startDate: null, endDate: null });

    await expect(as.mutation(api.sprints.update, { id: sprint.id, endDate: 'no es fecha' })).rejects.toThrow();
    await expect(as.mutation(api.sprints.create, { systemId, name: 'Sprint 2', startDate: '' })).rejects.toThrow();
    expect((await as.query(api.sprints.bySystem, { systemId })).map((s) => [s.name, s.startDate, s.endDate])).toEqual([['Sprint 1', null, null]]);
  });
});
