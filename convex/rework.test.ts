import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { asegurarDuenoYAgentes } from './migrations/tablasDelRework';
import { EXPIRES_IN_DAYS, MAX_PENDING } from './proposals';
import schema from './schema';

// Las siete tablas del rework nacen sin lector ni escritor de producto. Lo que
// se comprueba aquí es su forma, sus topes y su retención: todo lo que las
// fases siguientes van a dar por cierto.

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const bob = { subject: 'user_bob', email: 'bob@usekino.dev', name: 'Bob' };

const DIA = 86_400_000;

describe('el tope de propuestas', () => {
  it('la veintiuna se rechaza, y resolver una deja sitio para otra', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const userId = await asAna.mutation(api.users.ensure, {});

    const creadas: Id<'proposals'>[] = [];
    for (let i = 0; i < MAX_PENDING; i += 1) {
      const { id } = await asAna.mutation(api.proposals.create, {
        kind: 'archive',
        evidenceType: 'task',
        evidenceId: `tasks:${i}`,
      });
      creadas.push(id);
    }
    expect(creadas).toHaveLength(MAX_PENDING);

    await expect(
      asAna.mutation(api.proposals.create, { kind: 'archive', evidenceType: 'task', evidenceId: 'tasks:21' }),
    ).rejects.toThrow();

    // Sólo cuentan las pendientes: una resuelta libera el hueco.
    await t.run((ctx) => ctx.db.patch(creadas[0], { status: 'applied', resolvedAt: Date.now() }));
    const extra = await asAna.mutation(api.proposals.create, {
      kind: 'cancel',
      evidenceType: 'task',
      evidenceId: 'tasks:21',
    });
    expect(extra.id).toBeDefined();

    const mias = await t.run((ctx) => ctx.db.query('proposals').collect());
    expect(mias.every((p) => p.userId === userId)).toBe(true);
    expect(mias[0].expiresAt).toBeGreaterThan(Date.now() + (EXPIRES_IN_DAYS - 1) * DIA);
  });

  it('el tope es por usuario, no global', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    await asAna.mutation(api.users.ensure, {});
    for (let i = 0; i < MAX_PENDING; i += 1) {
      await asAna.mutation(api.proposals.create, { kind: 'archive', evidenceType: 'task', evidenceId: `tasks:${i}` });
    }
    await expect(
      asAna.mutation(api.proposals.create, { kind: 'archive', evidenceType: 'task', evidenceId: 'x' }),
    ).rejects.toThrow();

    const asBob = t.withIdentity(bob);
    await asBob.mutation(api.users.ensure, {});
    const suya = await asBob.mutation(api.proposals.create, { kind: 'archive', evidenceType: 'task', evidenceId: 'x' });
    expect(suya.id).toBeDefined();
  });
});

describe('la membresía de los sistemas', () => {
  it('el backfill deja exactamente una fila de dueño por sistema y no duplica', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    await asAna.mutation(api.systems.create, { name: 'Uno', color: 'blue', icon: 'x' });
    await asAna.mutation(api.systems.create, { name: 'Dos', color: 'red', icon: 'y' });
    // Un sistema anterior al ticket: sin memberAgentsAllowed.
    await t.run(async (ctx) => {
      const [alguno] = await ctx.db.query('systems').collect();
      await ctx.db.patch(alguno._id, { memberAgentsAllowed: undefined });
    });

    const pasada = async () =>
      t.run(async (ctx) => {
        for (const doc of await ctx.db.query('systems').collect()) {
          const patch = await asegurarDuenoYAgentes(ctx, doc);
          if (patch) await ctx.db.patch(doc._id, patch);
        }
      });

    await pasada();
    const primera = await t.run((ctx) => ctx.db.query('systemMembers').collect());
    expect(primera).toHaveLength(2);
    expect(primera.every((row) => row.role === 'owner')).toBe(true);

    await pasada();
    expect(await t.run((ctx) => ctx.db.query('systemMembers').collect())).toHaveLength(2);
    const sistemas = await t.run((ctx) => ctx.db.query('systems').collect());
    expect(sistemas.every((doc) => doc.memberAgentsAllowed === false)).toBe(true);
  });

  it('un sistema nuevo nace con los agentes de sus miembros prohibidos', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const system = await asAna.mutation(api.systems.create, { name: 'Kino', color: 'blue', icon: 'x' });
    const doc = await t.run((ctx) => ctx.db.get(system.id as Id<'systems'>));
    expect(doc!.memberAgentsAllowed).toBe(false);
  });
});

describe('el digest del que nació una tarea', () => {
  it('se escribe y se lee', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const userId = await asAna.mutation(api.users.ensure, {});
    const system = await asAna.mutation(api.systems.create, { name: 'Kino', color: 'blue', icon: 'x' });
    const task = await asAna.mutation(api.tasks.create, { systemId: system.id, title: 'Salida de un digest' });

    const digestId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('sessionDigests', {
        userId,
        source: 'github',
        externalId: 'pr-42',
        digest: { titulo: 'Lo que pasó ayer' },
        createdAt: Date.now(),
      });
      await ctx.db.patch(task.id as Id<'tasks'>, { digestId: id });
      return id;
    });

    const leida = await t.run(async (ctx) => {
      const doc = (await ctx.db.get(task.id as Id<'tasks'>))!;
      return doc.digestId ? await ctx.db.get(doc.digestId) : null;
    });
    expect(leida!._id).toBe(digestId);
    expect(leida!.externalId).toBe('pr-42');
  });
});

describe('mover una página de carpeta', () => {
  it('a una carpeta de otro sistema falla, igual que en tareas', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const uno = await asAna.mutation(api.systems.create, { name: 'Uno', color: 'blue', icon: 'x' });
    const dos = await asAna.mutation(api.systems.create, { name: 'Dos', color: 'red', icon: 'y' });
    const carpetaDeUno = await asAna.mutation(api.folders.create, { systemId: uno.id, name: 'Parte' });
    const carpetaDeDos = await asAna.mutation(api.folders.create, { systemId: dos.id, name: 'Ajena' });
    const page = await asAna.mutation(api.pages.create, { systemId: uno.id, title: 'Capítulo' });

    await expect(asAna.mutation(api.pages.update, { id: page.id, folderId: carpetaDeDos.id })).rejects.toThrow();
    const movida = await asAna.mutation(api.pages.update, { id: page.id, folderId: carpetaDeUno.id });
    expect(movida.folderId).toBe(carpetaDeUno.id);
  });
});

describe('la caducidad de una captura', () => {
  it('nace pendiente con fecha de caducidad y se resuelve al confirmarla', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const userId = await asAna.mutation(api.users.ensure, {});

    const id = await t.run((ctx) =>
      ctx.db.insert('captures', {
        userId,
        status: 'pending',
        kind: 'voice',
        blobPath: 'capturas/ana/nota.webm',
        durationSeconds: 42,
        expiresAt: Date.now() + 2 * DIA,
        createdAt: Date.now(),
      }),
    );

    const pendientes = await t.run((ctx) =>
      ctx.db
        .query('captures')
        .withIndex('by_user_status', (q) => q.eq('userId', userId).eq('status', 'pending'))
        .collect(),
    );
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].expiresAt).toBeGreaterThan(Date.now());
    expect(pendientes[0].durationSeconds).toBe(42);

    await t.run((ctx) => ctx.db.patch(id, { status: 'confirmed', resolvedAt: Date.now() }));
    const quedan = await t.run((ctx) =>
      ctx.db
        .query('captures')
        .withIndex('by_user_status', (q) => q.eq('userId', userId).eq('status', 'pending'))
        .collect(),
    );
    expect(quedan).toHaveLength(0);
  });
});
