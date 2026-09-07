import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { MCP_TOKEN_ISSUER } from './lib/mcpToken';
import schema from './schema';

// El contrato de autoría: todo documento que nace guarda quién lo creó y por
// qué puerta entró, y todo cierre guarda quién lo cerró. Los nueve sitios de
// inserción se comprueban aquí, en un solo fichero, porque son un contrato
// transversal y no la funcionalidad de un módulo.

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
/** La misma persona, entrando por un cliente OAuth del MCP en vez del navegador. */
const anaPorMcp = { ...ana, issuer: MCP_TOKEN_ISSUER };

async function conSistema(t: ReturnType<typeof convexTest>, identity = ana) {
  const asAna = t.withIdentity(identity);
  const system = await asAna.mutation(api.systems.create, {
    name: 'Novela',
    color: 'purple',
    templateType: 'writing',
    icon: 'book',
  });
  const userId = await asAna.mutation(api.users.ensure, {});
  return { asAna, userId, systemId: system.id };
}

describe('autoría al crear', () => {
  it('las seis tablas guardan quién creó y por qué vía', async () => {
    const t = convexTest(schema, modules);
    const { asAna, userId, systemId } = await conSistema(t);

    const folder = await asAna.mutation(api.folders.create, { systemId, name: 'Parte 1' });
    const page = await asAna.mutation(api.pages.create, { systemId, folderId: folder.id, title: 'Capítulo 1' });
    await asAna.mutation(api.tasks.create, { systemId, title: 'Escribir' });
    await asAna.mutation(api.stickyNotes.createOnPage, { pageId: page.id, content: 'Idea' });
    await asAna.mutation(api.entities.create, { systemId, type: 'character', name: 'Marta' });

    const rows = await t.run(async (ctx) => ({
      systems: await ctx.db.query('systems').collect(),
      folders: await ctx.db.query('folders').collect(),
      pages: await ctx.db.query('pages').collect(),
      tasks: await ctx.db.query('tasks').collect(),
      stickyNotes: await ctx.db.query('stickyNotes').collect(),
      entities: await ctx.db.query('entities').collect(),
    }));

    for (const [tabla, docs] of Object.entries(rows)) {
      expect(docs, tabla).not.toHaveLength(0);
      for (const doc of docs) {
        expect(doc.createdBy, `${tabla}.createdBy`).toBe(userId);
        expect(doc.createdVia, `${tabla}.createdVia`).toBe('session');
      }
    }
  });

  it('un cliente OAuth del MCP queda registrado como oauth, no como sesión', async () => {
    const t = convexTest(schema, modules);
    const { asAna, userId, systemId } = await conSistema(t, anaPorMcp);
    await asAna.mutation(api.tasks.create, { systemId, title: 'La propuso un agente' });

    const [task] = await t.run((ctx) => ctx.db.query('tasks').collect());
    expect(task.createdBy).toBe(userId);
    expect(task.createdVia).toBe('oauth');
    // El sistema lo creó la misma llamada por MCP, así que también es oauth.
    const [system] = await t.run((ctx) => ctx.db.query('systems').collect());
    expect(system.createdVia).toBe('oauth');
  });

  it('la bandeja la firma el sistema, no la persona', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    await asAna.mutation(api.systems.setup, {});
    const [inbox] = await t.run((ctx) => ctx.db.query('systems').collect());
    expect(inbox.isInbox).toBe(true);
    expect(inbox.createdVia).toBe('system');
  });

  it('la siembra del onboarding firma todo lo que crea', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const userId = await asAna.mutation(api.users.ensure, {});
    await asAna.mutation(api.onboarding.complete, {
      identity: 'estudiante',
      chronotype: 'morning',
      sleepTypicalHours: 8,
      availableHoursPerDay: 6,
      firstSystemName: 'Semestre',
      seedUnits: [{ name: 'Cálculo' }],
    });

    const rows = await t.run(async (ctx) => ({
      systems: await ctx.db.query('systems').collect(),
      folders: await ctx.db.query('folders').collect(),
      tasks: await ctx.db.query('tasks').collect(),
      pages: await ctx.db.query('pages').collect(),
    }));
    const sembrado = [...rows.systems, ...rows.folders, ...rows.tasks, ...rows.pages];
    expect(sembrado.length).toBeGreaterThan(0);
    for (const doc of sembrado) {
      expect(doc.createdBy).toBe(userId);
      expect(doc.createdVia).toBe('session');
    }
  });

  it('un issue importado de GitHub se firma como sincronización', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const userId = await asAna.mutation(api.users.ensure, {});
    const system = await asAna.mutation(api.systems.create, {
      name: 'Kino',
      color: 'blue',
      templateType: 'project',
      icon: 'rocket',
    });
    await t.mutation(internal.githubData.applySync, {
      userId,
      systemId: system.id,
      truncated: false,
      issues: [
        { id: 1, number: 1, title: 'Abierto', body: null, state: 'open', htmlUrl: 'https://x/1', milestone: null },
        { id: 2, number: 2, title: 'Cerrado', body: null, state: 'closed', htmlUrl: 'https://x/2', milestone: null },
      ],
    });

    const tasks = await t.run((ctx) => ctx.db.query('tasks').collect());
    expect(tasks).toHaveLength(2);
    for (const task of tasks) {
      expect(task.createdBy).toBe(userId);
      expect(task.createdVia).toBe('sync');
    }
    // El que llegó cerrado trae su cierre firmado; el abierto no tiene ninguno.
    // El título lleva el número del issue delante: `#2 Cerrado`.
    const cerrado = tasks.find((task) => task.title.endsWith('Cerrado'))!;
    const abierto = tasks.find((task) => task.title.endsWith('Abierto'))!;
    expect(cerrado.completedBy).toBe(userId);
    expect(cerrado.completedVia).toBe('sync');
    expect(abierto.completedBy).toBeUndefined();
    expect(abierto.completedVia).toBeUndefined();
  });

  it('la siguiente ocurrencia de una serie hereda el autor y la firma el sistema', async () => {
    const t = convexTest(schema, modules);
    const { asAna, userId, systemId } = await conSistema(t);
    const task = await asAna.mutation(api.tasks.create, {
      systemId,
      title: 'Regar las plantas',
      dueDate: new Date(Date.now() + 86_400_000).toISOString(),
      recurrenceRule: 'FREQ=DAILY',
    });
    await asAna.mutation(api.tasks.toggle, { id: task.id });

    const tasks = await t.run((ctx) => ctx.db.query('tasks').collect());
    expect(tasks.length).toBeGreaterThan(1);
    const siguiente = tasks.find((doc) => doc._id !== task.id)!;
    expect(siguiente.createdBy).toBe(userId);
    expect(siguiente.createdVia).toBe('system');
  });
});

describe('firma del cierre', () => {
  it('completar una tarea escribe quién y por qué vía, y deshacerlo los borra', async () => {
    const t = convexTest(schema, modules);
    const { asAna, userId, systemId } = await conSistema(t);
    const task = await asAna.mutation(api.tasks.create, { systemId, title: 'Terminar' });

    await asAna.mutation(api.tasks.toggle, { id: task.id });
    const cerrada = await t.run((ctx) => ctx.db.get(task.id as Id<'tasks'>));
    expect(cerrada!.completedAt).toEqual(expect.any(Number));
    expect(cerrada!.completedBy).toBe(userId);
    expect(cerrada!.completedVia).toBe('session');

    await asAna.mutation(api.tasks.toggle, { id: task.id });
    const reabierta = await t.run((ctx) => ctx.db.get(task.id as Id<'tasks'>));
    expect(reabierta!.completedAt).toBeUndefined();
    expect(reabierta!.completedBy).toBeUndefined();
    expect(reabierta!.completedVia).toBeUndefined();
  });

  it('completar un capítulo escribe quién y por qué vía', async () => {
    const t = convexTest(schema, modules);
    const { asAna, userId, systemId } = await conSistema(t);
    const page = await asAna.mutation(api.pages.create, { systemId, title: 'Capítulo 1' });

    await asAna.mutation(api.writing.setCompleted, { id: page.id, completed: true });
    const cerrada = await t.run((ctx) => ctx.db.get(page.id as Id<'pages'>));
    expect(cerrada!.completedBy).toBe(userId);
    expect(cerrada!.completedVia).toBe('session');

    await asAna.mutation(api.writing.setCompleted, { id: page.id, completed: false });
    const abierta = await t.run((ctx) => ctx.db.get(page.id as Id<'pages'>));
    expect(abierta!.completedAt).toBeUndefined();
    expect(abierta!.completedBy).toBeUndefined();
    expect(abierta!.completedVia).toBeUndefined();
  });
});

describe('la papelera de carpetas y notas', () => {
  it('borrar una nota la marca y la saca de las listas, sin destruirla', async () => {
    const t = convexTest(schema, modules);
    const { asAna, systemId } = await conSistema(t);
    const page = await asAna.mutation(api.pages.create, { systemId, title: 'Capítulo 1' });
    const note = await asAna.mutation(api.stickyNotes.createOnPage, { pageId: page.id, content: 'Idea' });

    expect(await asAna.query(api.stickyNotes.byPage, { pageId: page.id })).toHaveLength(1);
    await asAna.mutation(api.stickyNotes.remove, { id: note.id });
    expect(await asAna.query(api.stickyNotes.byPage, { pageId: page.id })).toHaveLength(0);

    const [doc] = await t.run((ctx) => ctx.db.query('stickyNotes').collect());
    expect(doc.deletedAt).toEqual(expect.any(Number));
    expect(doc.content).toBe('Idea');
  });

  it('borrar una carpeta la marca a ella y a su subárbol, y las notas caen con ella', async () => {
    const t = convexTest(schema, modules);
    const { asAna, systemId } = await conSistema(t);
    const parte = await asAna.mutation(api.folders.create, { systemId, name: 'Parte 1' });
    const capitulo = await asAna.mutation(api.folders.create, { systemId, name: 'Capítulo 1', parentId: parte.id });
    await asAna.mutation(api.stickyNotes.createOnFolder, { folderId: capitulo.id, content: 'Pegada' });

    await asAna.mutation(api.folders.remove, { id: parte.id });
    expect(await asAna.query(api.folders.tree, {})).toEqual([]);
    expect(await asAna.query(api.stickyNotes.byFolder, { folderId: capitulo.id })).toHaveLength(0);

    const left = await t.run(async (ctx) => ({
      folders: await ctx.db.query('folders').collect(),
      notes: await ctx.db.query('stickyNotes').collect(),
    }));
    expect(left.folders).toHaveLength(2);
    expect(left.folders.every((doc) => doc.deletedAt !== undefined)).toBe(true);
    expect(left.notes[0].deletedAt).toEqual(expect.any(Number));
  });
});

describe('la cuenta activa', () => {
  it('se marca una vez al día y la segunda llamada del mismo día no escribe', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const userId = await asAna.mutation(api.users.ensure, {});

    expect(await asAna.mutation(api.users.touch, {})).toBe(true);
    const primera = (await t.run((ctx) => ctx.db.get(userId)))!.lastActiveAt;
    expect(primera).toEqual(expect.any(Number));

    expect(await asAna.mutation(api.users.touch, {})).toBe(false);
    expect((await t.run((ctx) => ctx.db.get(userId)))!.lastActiveAt).toBe(primera);

    // Con la última visita en otro día natural vuelve a escribir.
    await t.run((ctx) => ctx.db.patch(userId, { lastActiveAt: Date.now() - 3 * 86_400_000 }));
    expect(await asAna.mutation(api.users.touch, {})).toBe(true);
  });
});

describe('las columnas del tablero de un proyecto', () => {
  it('la siembra las deja y reejecutarla no duplica', async () => {
    const t = convexTest(schema, modules);

    const primera = await t.mutation(internal.migrations.autoriaYPapelera.sembrarColumnasDeProyecto, {});
    expect(primera).toEqual({ insertadas: 4, corregidas: 0 });
    const columnas = await t.run((ctx) => ctx.db.query('systemStatusDefinitions').collect());
    expect(columnas.map((c) => c.statusName)).toEqual(['todo', 'in_progress', 'review', 'done']);
    expect(columnas.map((c) => c.position)).toEqual([0, 1, 2, 3]);

    const segunda = await t.mutation(internal.migrations.autoriaYPapelera.sembrarColumnasDeProyecto, {});
    expect(segunda).toEqual({ insertadas: 0, corregidas: 0 });
    expect(await t.run((ctx) => ctx.db.query('systemStatusDefinitions').collect())).toHaveLength(4);
  });

  it('sin las columnas sembradas un proyecto no puede mover una tarjeta', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const system = await asAna.mutation(api.systems.create, { name: 'Kino', color: 'blue', templateType: 'project', icon: 'rocket' });
    const task = await asAna.mutation(api.tasks.create, { systemId: system.id, title: 'Tarjeta' });

    await expect(asAna.mutation(api.tasks.moveBoard, { id: task.id, boardStatus: 'in_progress' })).rejects.toThrow();
    await t.mutation(internal.migrations.autoriaYPapelera.sembrarColumnasDeProyecto, {});
    const movida = await asAna.mutation(api.tasks.moveBoard, { id: task.id, boardStatus: 'in_progress' });
    expect(movida.boardStatus).toBe('in_progress');
  });
});
