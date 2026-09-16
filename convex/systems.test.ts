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

describe('la radiografía', () => {
  const dia = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString();

  it('un sistema recién creado dice que todavía no hay nada que contar', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const system = await asAna.mutation(api.systems.create, { name: 'Nuevo', color: 'blue', icon: 'book' });

    const radiografia = await asAna.query(api.systems.radiografia, { id: system.id });

    expect(radiografia.unstarted).toBe(true);
    expect(radiografia.facts).toEqual([]);
    expect(radiografia.paragraph).toContain('todavía no hay nada que contar');
  });

  it('cada hecho cita la fila de la que sale, y ninguno se inventa un número', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const system = await asAna.mutation(api.systems.create, {
      name: 'Cálculo', color: 'blue', templateType: 'academic', icon: 'book',
    });
    const vencida = await asAna.mutation(api.tasks.create, { systemId: system.id, title: 'Entrega 1', dueDate: dia(-5) });
    await asAna.mutation(api.tasks.create, { systemId: system.id, title: 'Entrega 2', dueDate: dia(-2) });
    await asAna.mutation(api.tasks.create, { systemId: system.id, title: 'Examen parcial', dueDate: dia(4) });
    const hecha = await asAna.mutation(api.tasks.create, { systemId: system.id, title: 'Lectura 1' });
    await asAna.mutation(api.tasks.toggle, { id: hecha.id });
    const vacia = await asAna.mutation(api.folders.create, { systemId: system.id, name: 'Álgebra' });

    const radiografia = await asAna.query(api.systems.radiografia, { id: system.id });
    const porTipo = new Map(radiografia.facts.map((fact) => [fact.kind, fact]));

    // Dos vencidas de verdad, y el hecho señala la más vieja de las dos.
    expect(porTipo.get('overdue')).toMatchObject({
      title: '2 tareas pasaron de fecha',
      target: { kind: 'task', id: vencida.id },
    });
    expect(porTipo.get('overdue')!.reason).toContain('Entrega 1');
    // La próxima con fecha es la única que no ha pasado.
    expect(porTipo.get('next-due')).toMatchObject({ title: 'Lo próximo es «Examen parcial»' });
    // La carpeta vacía habla con el sustantivo del arquetipo, no con "carpeta".
    expect(porTipo.get('empty-container')).toMatchObject({
      title: '1 clase sin una sola tarea',
      target: { kind: 'folder', id: vacia.id },
    });
    // Y el párrafo cuenta lo que hay: tres vivas, una cerrada, una clase.
    expect(radiografia.paragraph).toContain('3 tareas vivas, 1 cerrada y 1 clase');
    expect(radiografia.unstarted).toBe(false);
  });

  it('un hecho cuya fila ya no existe deja de pintarse', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const system = await asAna.mutation(api.systems.create, { name: 'Cálculo', color: 'blue', icon: 'book' });
    const vencida = await asAna.mutation(api.tasks.create, { systemId: system.id, title: 'Entrega 1', dueDate: dia(-5) });

    const antes = await asAna.query(api.systems.radiografia, { id: system.id });
    expect(antes.facts.some((fact) => fact.target.id === vencida.id)).toBe(true);

    await asAna.mutation(api.tasks.remove, { id: vencida.id });
    const despues = await asAna.query(api.systems.radiografia, { id: system.id });

    expect(despues.facts.some((fact) => fact.kind === 'overdue')).toBe(false);
    expect(despues.facts.some((fact) => fact.target.id === vencida.id)).toBe(false);
  });

  it('las tareas se acumulan donde de verdad están, y la radiografía es sólo de su dueño', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const system = await asAna.mutation(api.systems.create, { name: 'Tesis', color: 'blue', icon: 'book' });
    for (const title of ['Capítulo 1', 'Capítulo 2', 'Capítulo 3']) {
      await asAna.mutation(api.tasks.create, { systemId: system.id, title });
    }

    const radiografia = await asAna.query(api.systems.radiografia, { id: system.id });

    expect(radiografia.facts.find((fact) => fact.kind === 'pileup')).toMatchObject({
      title: '3 tareas se acumulan en Backlog',
    });

    const asLuis = t.withIdentity({ subject: 'user_luis', email: 'luis@example.com' });
    await asLuis.mutation(api.users.ensure, {});
    await expect(asLuis.query(api.systems.radiografia, { id: system.id })).rejects.toThrow();
  });
});
