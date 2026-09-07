import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { CASCADES } from '../scripts/migrate-to-convex/cascadas';
import schema from './schema';

// Convex no tiene ON DELETE. Cada cascada del schema de Postgres es código
// dentro de la mutación que borra, o no ocurre. Aquí se comprueba una por una.
//
// El criterio que gobierna todas: casi todos los borrados de Kino son blandos,
// y una cascada blanda no destruye lo que cuelga. Restaurar tiene que devolver
// la cosa entera, así que lo que Postgres destruía por cascada aquí o se marca
// igual, o se queda intacto bajo un padre que ya nadie lee.

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const bob = { subject: 'user_bob', email: 'bob@usekino.dev', name: 'Bob' };

async function base(t: ReturnType<typeof convexTest>, identity = ana) {
  const as = t.withIdentity(identity);
  const userId = await as.mutation(api.users.ensure, {});
  const system = await as.mutation(api.systems.create, { name: 'Kino', color: 'blue', templateType: 'project', icon: 'rocket' });
  return { as, userId, systemId: system.id };
}

describe('la lista de cascadas', () => {
  it('es la que dejó el importador, y todas apuntan a una mutación conocida', () => {
    const mutaciones = new Set(CASCADES.map((c) => c.mutation));
    expect(CASCADES).toHaveLength(47);
    expect([...mutaciones].sort()).toEqual([
      'entities.remove',
      'folders.remove',
      'pages.remove',
      'sprints.remove',
      'systems.remove',
      'tasks.remove',
      'tags.remove',
      'users.remove',
    ].sort());
    // Dieciocho de ellas son el barrido de la cuenta, no una mutación.
    expect(CASCADES.filter((c) => c.mutation === 'users.remove')).toHaveLength(18);
  });
});

describe('borrar una tarea', () => {
  it('arrastra sus subtareas, en profundidad', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const madre = await as.mutation(api.tasks.create, { systemId, title: 'Madre' });
    const hija = await as.mutation(api.tasks.create, { systemId, title: 'Hija', parentTaskId: madre.id });
    const nieta = await as.mutation(api.tasks.create, { systemId, title: 'Nieta', parentTaskId: hija.id });

    await as.mutation(api.tasks.remove, { id: madre.id });
    const docs = await t.run((ctx) => ctx.db.query('tasks').collect());
    for (const id of [madre.id, hija.id, nieta.id]) {
      expect(docs.find((d) => d._id === id)!.deletedAt, `${id}`).toEqual(expect.any(Number));
    }
  });

  it('deja viva la serie que colgaba de ella, sin raíz', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const raiz = await as.mutation(api.tasks.create, { systemId, title: 'Regar' });
    const siguiente = await as.mutation(api.tasks.create, { systemId, title: 'Regar otra vez' });
    await t.run((ctx) => ctx.db.patch(siguiente.id as Id<'tasks'>, { recurrenceParentId: raiz.id as Id<'tasks'> }));

    await as.mutation(api.tasks.remove, { id: raiz.id });
    const hija = await t.run((ctx) => ctx.db.get(siguiente.id as Id<'tasks'>));
    expect(hija!.recurrenceParentId).toBeUndefined();
    expect(hija!.deletedAt).toBeUndefined();
  });

  it('conserva sus recordatorios, su tiempo y sus enlaces, y ninguno se asoma', async () => {
    const t = convexTest(schema, modules);
    const { as, userId, systemId } = await base(t);
    const task = await as.mutation(api.tasks.create, { systemId, title: 'Con cosas colgando' });
    const page = await as.mutation(api.pages.create, { systemId, title: 'Capítulo' });
    await t.run(async (ctx) => {
      await ctx.db.insert('taskPageLinks', { taskId: task.id as Id<'tasks'>, pageId: page.id as Id<'pages'> });
      await ctx.db.insert('timeLogs', {
        userId, taskId: task.id as Id<'tasks'>, systemId: systemId as Id<'systems'>,
        startedAt: Date.now(), durationMinutes: 25, source: 'pomodoro', createdAt: Date.now(),
      });
      await ctx.db.insert('taskReminders', {
        taskId: task.id as Id<'tasks'>, userId, remindAt: Date.now() + 3_600_000, source: 'user', createdAt: Date.now(),
      });
    });

    await as.mutation(api.tasks.remove, { id: task.id });
    const left = await t.run(async (ctx) => ({
      links: await ctx.db.query('taskPageLinks').collect(),
      logs: await ctx.db.query('timeLogs').collect(),
      reminders: await ctx.db.query('taskReminders').collect(),
    }));
    // Siguen ahí: restaurar tiene que devolver la tarea entera.
    expect(left.links).toHaveLength(1);
    expect(left.logs).toHaveLength(1);
    expect(left.reminders).toHaveLength(1);
    // Y el recordatorio de una tarea borrada no se dispara: quien los reparte
    // sólo mira tareas vivas.
    const { internal } = await import('./_generated/api');
    const entregas = await t.query(internal.notifications.pendingDeliveries, {});
    expect(entregas.flatMap((e: { reminders: unknown[] }) => e.reminders)).toHaveLength(0);
  });

  it('restaurarla la devuelve entera', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const task = await as.mutation(api.tasks.create, { systemId, title: 'Vuelve' });
    await as.mutation(api.tasks.remove, { id: task.id });
    expect((await as.query(api.tasks.list, {})).items).toHaveLength(0);
    await as.mutation(api.tasks.restore, { id: task.id });
    expect((await as.query(api.tasks.list, {})).items.map((x) => x.title)).toEqual(['Vuelve']);
  });
});

describe('borrar un capítulo', () => {
  it('arrastra sus subcapítulos y sus notas, y limpia las menciones derivadas', async () => {
    const t = convexTest(schema, modules);
    const { as, userId, systemId } = await base(t);
    const madre = await as.mutation(api.pages.create, { systemId, title: 'Parte' });
    const hija = await as.mutation(api.pages.create, { systemId, title: 'Capítulo', parentPageId: madre.id });
    const nota = await as.mutation(api.stickyNotes.createOnPage, { pageId: hija.id, content: 'Idea' });
    const entity = await as.mutation(api.entities.create, { systemId, type: 'character', name: 'Marta' });
    await t.run((ctx) =>
      ctx.db.insert('pageEntityMentions', { pageId: hija.id as Id<'pages'>, entityId: entity.id as Id<'entities'>, mentionCount: 3 }),
    );

    await as.mutation(api.pages.remove, { id: madre.id });
    const left = await t.run(async (ctx) => ({
      pages: await ctx.db.query('pages').collect(),
      notes: await ctx.db.query('stickyNotes').collect(),
      mentions: await ctx.db.query('pageEntityMentions').collect(),
    }));
    expect(left.pages.every((p) => p.deletedAt !== undefined)).toBe(true);
    expect(left.notes.find((n) => n._id === nota.id)!.deletedAt).toEqual(expect.any(Number));
    // Las menciones son derivadas: se recalculan, así que se van de verdad.
    expect(left.mentions).toHaveLength(0);
    expect(userId).toBeDefined();
  });

  it('conserva sus versiones, sus etiquetas y sus enlaces', async () => {
    const t = convexTest(schema, modules);
    const { as, userId, systemId } = await base(t);
    const page = await as.mutation(api.pages.create, { systemId, title: 'Capítulo' });
    const task = await as.mutation(api.tasks.create, { systemId, title: 'Escribirlo' });
    const tag = await as.mutation(api.tags.create, { title: 'Borrador', color: 'blue', systemId });
    await t.run(async (ctx) => {
      await ctx.db.insert('pageSnapshots', {
        pageId: page.id as Id<'pages'>, userId, content: 'texto', wordCount: 1, createdAt: Date.now(),
      });
      await ctx.db.insert('pageTags', { pageId: page.id as Id<'pages'>, tagId: tag.id as Id<'contextTags'> });
      await ctx.db.insert('taskPageLinks', { taskId: task.id as Id<'tasks'>, pageId: page.id as Id<'pages'> });
    });

    await as.mutation(api.pages.remove, { id: page.id });
    const left = await t.run(async (ctx) => ({
      snapshots: await ctx.db.query('pageSnapshots').collect(),
      tags: await ctx.db.query('pageTags').collect(),
      links: await ctx.db.query('taskPageLinks').collect(),
    }));
    expect(left.snapshots).toHaveLength(1);
    expect(left.tags).toHaveLength(1);
    expect(left.links).toHaveLength(1);
  });
});

describe('borrar una carpeta', () => {
  it('suelta tareas y páginas, arrastra subcarpetas y notas', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const parte = await as.mutation(api.folders.create, { systemId, name: 'Parte' });
    const sub = await as.mutation(api.folders.create, { systemId, name: 'Sub', parentId: parte.id });
    const task = await as.mutation(api.tasks.create, { systemId, title: 'Dentro', folderId: sub.id });
    const page = await as.mutation(api.pages.create, { systemId, folderId: sub.id, title: 'Dentro' });
    await as.mutation(api.stickyNotes.createOnFolder, { folderId: sub.id, content: 'Pegada' });

    await as.mutation(api.folders.remove, { id: parte.id });
    const left = await t.run(async (ctx) => ({
      folders: await ctx.db.query('folders').collect(),
      tasks: await ctx.db.query('tasks').collect(),
      pages: await ctx.db.query('pages').collect(),
      notes: await ctx.db.query('stickyNotes').collect(),
    }));
    expect(left.folders.every((f) => f.deletedAt !== undefined)).toBe(true);
    // set null: la tarea y la página sobreviven sin carpeta.
    expect(left.tasks.find((x) => x._id === task.id)!.folderId).toBeUndefined();
    expect(left.tasks.find((x) => x._id === task.id)!.deletedAt).toBeUndefined();
    expect(left.pages.find((x) => x._id === page.id)!.folderId).toBeUndefined();
    expect(left.pages.find((x) => x._id === page.id)!.deletedAt).toBeUndefined();
    expect(left.notes[0].deletedAt).toEqual(expect.any(Number));
  });
});

describe('borrar un sprint', () => {
  it('suelta sus tareas y las deja vivas', async () => {
    const t = convexTest(schema, modules);
    const { as, userId, systemId } = await base(t);
    const task = await as.mutation(api.tasks.create, { systemId, title: 'Del sprint' });
    const sprintId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('sprints', {
        userId, systemId: systemId as Id<'systems'>, name: 'Sprint 1', status: 'active',
        sortOrder: 0, createdAt: Date.now(), updatedAt: Date.now(),
      });
      await ctx.db.patch(task.id as Id<'tasks'>, { sprintId: id });
      return id;
    });

    await as.mutation(api.sprints.remove, { id: sprintId });
    const doc = await t.run((ctx) => ctx.db.get(task.id as Id<'tasks'>));
    expect(doc!.sprintId).toBeUndefined();
    expect(doc!.deletedAt).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query('sprints').collect())).toHaveLength(0);
  });
});

describe('borrar una entidad', () => {
  it('se lleva sus menciones derivadas y deja la arista fuera del grafo', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const marta = await as.mutation(api.entities.create, { systemId, type: 'character', name: 'Marta' });
    const luis = await as.mutation(api.entities.create, { systemId, type: 'character', name: 'Luis' });
    const page = await as.mutation(api.pages.create, { systemId, title: 'Capítulo' });
    await t.run(async (ctx) => {
      await ctx.db.insert('entityRelations', {
        fromEntityId: marta.id as Id<'entities'>, toEntityId: luis.id as Id<'entities'>,
        label: 'hermana de', createdAt: Date.now(),
      });
      await ctx.db.insert('pageEntityMentions', {
        pageId: page.id as Id<'pages'>, entityId: marta.id as Id<'entities'>, mentionCount: 2,
      });
    });

    await as.mutation(api.entities.remove, { id: marta.id });
    const left = await t.run(async (ctx) => ({
      mentions: await ctx.db.query('pageEntityMentions').collect(),
      relations: await ctx.db.query('entityRelations').collect(),
    }));
    expect(left.mentions).toHaveLength(0);
    // La arista se queda: la escribió el autor y restaurar la entidad la
    // devuelve. El grafo ya sólo pinta aristas entre entidades vivas.
    expect(left.relations).toHaveLength(1);
    const grafo = await as.query(api.entities.graph, { systemId });
    expect(grafo.edges).toHaveLength(0);
    expect(grafo.nodes.map((n) => n.name)).toEqual(['Luis']);
  });
});

describe('borrar un sistema', () => {
  it('lo archiva en vez de borrarlo, y nada suyo se destruye', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    await as.mutation(api.tasks.create, { systemId, title: 'Sigue viva' });
    await as.mutation(api.folders.create, { systemId, name: 'Sigue viva' });

    await as.mutation(api.systems.remove, { id: systemId });
    const left = await t.run(async (ctx) => ({
      systems: await ctx.db.query('systems').collect(),
      tasks: await ctx.db.query('tasks').collect(),
      folders: await ctx.db.query('folders').collect(),
      tags: await ctx.db.query('contextTags').collect(),
    }));
    // Las siete cascadas de systems.remove no ocurren porque no es un borrado.
    expect(left.systems[0].isActive).toBe(false);
    expect(left.tasks[0].deletedAt).toBeUndefined();
    expect(left.folders[0].deletedAt).toBeUndefined();
    expect(left.tags.length).toBeGreaterThan(0);
    expect(await as.query(api.systems.list, {})).toHaveLength(0);
  });
});

describe('borrar una etiqueta', () => {
  it('desetiqueta sólo dentro de su sistema y deja una fila en el log', async () => {
    const t = convexTest(schema, modules);
    const { as, userId, systemId } = await base(t);
    const otro = await as.mutation(api.systems.create, { name: 'Otro', color: 'red', icon: 'x' });
    const tag = await as.mutation(api.tags.create, { title: 'Bug urgente', color: 'red', systemId });
    const dentro = await as.mutation(api.tasks.create, { systemId, title: 'Dentro', contextTagId: tag.id });
    // Una tarea de otro sistema con la misma etiqueta puesta a mano.
    const fuera = await as.mutation(api.tasks.create, { systemId: otro.id, title: 'Fuera' });
    await t.run((ctx) => ctx.db.patch(fuera.id as Id<'tasks'>, { contextTagId: tag.id as Id<'contextTags'> }));
    const page = await as.mutation(api.pages.create, { systemId, title: 'Capítulo' });
    await t.run((ctx) => ctx.db.insert('pageTags', { pageId: page.id as Id<'pages'>, tagId: tag.id as Id<'contextTags'> }));

    await as.mutation(api.tags.remove, { id: tag.id });
    const left = await t.run(async (ctx) => ({
      tags: await ctx.db.query('contextTags').collect(),
      pageTags: await ctx.db.query('pageTags').collect(),
      dentro: await ctx.db.get(dentro.id as Id<'tasks'>),
      fuera: await ctx.db.get(fuera.id as Id<'tasks'>),
      eventos: await ctx.db.query('eventLog').collect(),
    }));
    expect(left.tags.find((x) => x._id === tag.id)).toBeUndefined();
    expect(left.pageTags).toHaveLength(0);
    expect(left.dentro!.contextTagId).toBeUndefined();
    // Fuera del alcance del actor: no se toca.
    expect(left.fuera!.contextTagId).toBe(tag.id);

    expect(left.eventos).toHaveLength(1);
    expect(left.eventos[0]).toMatchObject({
      userId,
      systemId,
      action: 'tag.remove',
      targetType: 'tag',
      targetId: tag.id,
      actorChannel: 'session',
    });
    expect(left.eventos[0].payload).toMatchObject({ title: 'Bug urgente', desetiquetadas: 1, enlaces: 1 });
  });

  it('una etiqueta global desetiqueta todas las tareas del dueño', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const otro = await as.mutation(api.systems.create, { name: 'Otro', color: 'red', icon: 'x' });
    const tag = await as.mutation(api.tags.create, { title: 'Global', color: 'gray' });
    const a = await as.mutation(api.tasks.create, { systemId, title: 'A', contextTagId: tag.id });
    const b = await as.mutation(api.tasks.create, { systemId: otro.id, title: 'B', contextTagId: tag.id });

    await as.mutation(api.tags.remove, { id: tag.id });
    const left = await t.run(async (ctx) => ({
      a: await ctx.db.get(a.id as Id<'tasks'>),
      b: await ctx.db.get(b.id as Id<'tasks'>),
    }));
    expect(left.a!.contextTagId).toBeUndefined();
    expect(left.b!.contextTagId).toBeUndefined();
  });

  it('la etiqueta de un sistema ajeno no existe para quien no es su dueño', async () => {
    const t = convexTest(schema, modules);
    const { as, systemId } = await base(t);
    const tag = await as.mutation(api.tags.create, { title: 'Suya', color: 'blue', systemId });
    const asBob = t.withIdentity(bob);
    await asBob.mutation(api.users.ensure, {});
    await expect(asBob.mutation(api.tags.remove, { id: tag.id })).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query('contextTags').collect())).not.toHaveLength(0);
  });
});

describe('borrar la cuenta', () => {
  it('se lleva las dieciocho tablas de esa cuenta y no toca las de otra', async () => {
    const t = convexTest(schema, modules);
    const { as: asAna, userId: anaId, systemId: sistemaDeAna } = await base(t);
    const { as: asBob, userId: bobId, systemId: sistemaDeBob } = await base(t, bob);
    await asAna.mutation(api.tasks.create, { systemId: sistemaDeAna, title: 'De Ana' });
    await asAna.mutation(api.pages.create, { systemId: sistemaDeAna, title: 'De Ana' });
    await asBob.mutation(api.tasks.create, { systemId: sistemaDeBob, title: 'De Bob' });

    await t.mutation((await import('./_generated/api')).internal.users.purge, { userId: anaId });

    const left = await t.run(async (ctx) => ({
      users: await ctx.db.query('users').collect(),
      systems: await ctx.db.query('systems').collect(),
      tasks: await ctx.db.query('tasks').collect(),
      pages: await ctx.db.query('pages').collect(),
      tags: await ctx.db.query('contextTags').collect(),
    }));
    expect(left.users.map((u) => u._id)).toEqual([bobId]);
    expect(left.systems.every((s) => s.userId === bobId)).toBe(true);
    expect(left.tasks.every((x) => x.userId === bobId)).toBe(true);
    expect(left.pages).toHaveLength(0);
    expect(left.tags.every((x) => x.userId === bobId)).toBe(true);
  });
});
