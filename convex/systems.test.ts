import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

describe('systems', () => {
  it('el detalle devuelve las señales de ese sistema y rechaza sistemas ajenos o archivados', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const system = await asAna.mutation(api.systems.create, { name: 'Clases', color: 'blue', icon: 'book' });
    const other = await asAna.mutation(api.systems.create, { name: 'Otro', color: 'gray', icon: 'book' });
    await asAna.mutation(api.tasks.create, { systemId: system.id, title: 'Práctica' });
    await asAna.mutation(api.tasks.create, { systemId: other.id, title: 'No cuenta aquí' });
    const detail = await asAna.query(api.systems.detail, { id: system.id });
    expect(detail).toMatchObject({ id: system.id, activeTaskCount: 1 });
    expect(detail).toEqual((await asAna.query(api.systems.list, {})).find((item) => item.id === system.id));
    const asLuis = t.withIdentity({ subject: 'user_luis', email: 'luis@example.com' });
    await asLuis.mutation(api.users.ensure, {});
    await expect(asLuis.query(api.systems.detail, { id: system.id })).rejects.toThrow();
    await asAna.mutation(api.systems.remove, { id: system.id });
    await expect(asAna.query(api.systems.detail, { id: system.id })).rejects.toThrow();
  });

  it('la bandeja se crea una vez y no se puede tocar', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    await asAna.mutation(api.systems.setup, {});
    await asAna.mutation(api.systems.setup, {});
    const list = await asAna.query(api.systems.list, {});
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ isInbox: true, stale: false, activeTaskCount: 0 });
    await expect(asAna.mutation(api.systems.remove, { id: list[0].id })).rejects.toThrow();
    await expect(asAna.mutation(api.systems.update, { id: list[0].id, name: 'Otro' })).rejects.toThrow();
  });

  it('un proyecto nace con sus tres etiquetas y el orden sigue al último', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    await asAna.mutation(api.systems.setup, {});
    const project = await asAna.mutation(api.systems.create, { name: 'Kino', color: 'blue', templateType: 'project', icon: 'rocket' });
    expect(project.sortOrder).toBe(1);
    const tags = await t.run((ctx) => ctx.db.query('contextTags').collect());
    expect(tags.map((tag) => tag.title).sort()).toEqual(['Bug', 'Chore', 'Feature']);

    await asAna.mutation(api.systems.reorder, { systemIds: [project.id] });
    expect((await asAna.query(api.systems.byId, { id: project.id })).sortOrder).toBe(0);
    await asAna.mutation(api.systems.remove, { id: project.id });
    expect((await asAna.query(api.systems.list, {})).map((s) => s.name)).toEqual(['Inbox']);
  });

  it('un sistema con trabajo pendiente y sin actividad reciente está parado', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const system = await asAna.mutation(api.systems.create, { name: 'Viejo', color: 'gray', icon: 'x', expectedFrequency: 'daily' });
    await t.run(async (ctx) => {
      const doc = (await ctx.db.get(system.id))!;
      const tenDaysAgo = Date.now() - 10 * 86_400_000;
      await ctx.db.patch(doc._id, { createdAt: tenDaysAgo });
      await ctx.db.insert('tasks', {
        userId: doc.userId, systemId: doc._id, title: 'Pendiente', status: 'backlog', energyLevel: 'medium', priority: 'medium',
        createdBy: doc.userId,
        createdVia: 'session',
        sortIndex: 0, inTodayPlan: false, notifiedBeforeDay: false, notifiedDueDay: false, reminderCount: 0, createdAt: tenDaysAgo, updatedAt: tenDaysAgo,
      });
    });
    const [item] = await asAna.query(api.systems.list, {});
    expect(item).toMatchObject({ stale: true, activeTaskCount: 1, daysSinceLastActivity: null });
  });
});
