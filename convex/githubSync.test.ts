/**
 * Las reglas del refresco de GitHub sobre el tablero: de quién es el cursor
 * incremental, qué pasa con una tarjeta que está en la papelera, y qué no puede
 * mover un issue que sólo recibió un comentario.
 *
 * Son las tres formas de perder trabajo que tiene esta integración: issues que
 * no vuelven nunca, tarjetas que resucitan, y tareas completadas que se
 * descompletan solas.
 */
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

/** Dos sistemas de tipo proyecto, cada uno con su repositorio, y la cuenta conectada. */
async function seed() {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const kino = await asAna.mutation(api.systems.create, { name: 'Kino', color: 'blue', templateType: 'project', icon: 'rocket' });
  const conocerd = await asAna.mutation(api.systems.create, { name: 'ConoceRD', color: 'green', templateType: 'project', icon: 'map' });
  await t.run(async (ctx) => {
    await ctx.db.insert('systemStatusDefinitions', { systemType: 'project', statusName: 'todo', label: 'Por hacer', position: 0 });
    await ctx.db.insert('systemStatusDefinitions', { systemType: 'project', statusName: 'doing', label: 'En curso', position: 1 });
    await ctx.db.insert('systemStatusDefinitions', { systemType: 'project', statusName: 'done', label: 'Hecho', position: 2 });
    await ctx.db.insert('syncConnections', { userId, provider: 'github', accessTokenEncrypted: 'cifrado', createdAt: Date.now(), updatedAt: Date.now() });
    return null;
  });
  await t.mutation(internal.githubData.linkRepoMeta, { userId, systemId: kino.id, owner: 'eliasdlc', repo: 'kino' });
  await t.mutation(internal.githubData.linkRepoMeta, { userId, systemId: conocerd.id, owner: 'eliasdlc', repo: 'conocerd' });
  return { t, asAna, userId, kino: kino.id, conocerd: conocerd.id };
}

const issue = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  number: 1,
  title: 'Arreglar el mapa',
  body: null,
  state: 'open' as const,
  htmlUrl: 'https://github.com/eliasdlc/kino/issues/1',
  milestone: null,
  ...overrides,
});

describe('el cursor incremental', () => {
  it('es de cada sistema: el segundo repositorio no hereda hasta dónde llegó el primero', async () => {
    const { t, userId, kino, conocerd } = await seed();
    const cursor = (systemId: typeof kino) => t.query(internal.githubData.systemForSync, { userId, systemId });
    const hasta = Date.now() - 60_000;

    await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: false, syncedThrough: hasta, issues: [issue()] });

    expect((await cursor(kino)).syncedThrough).toBe(hasta);
    // Lo que rompía: el segundo sistema arrancaba desde el cursor del primero y
    // sus issues viejos no entraban en ningún refresco.
    expect((await cursor(conocerd)).syncedThrough).toBeNull();
  });

  it('enlazar otro repositorio lo borra: el nuevo se trae entero', async () => {
    const { t, userId, kino } = await seed();
    await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: false, syncedThrough: Date.now(), issues: [issue()] });

    await t.mutation(internal.githubData.linkRepoMeta, { userId, systemId: kino, owner: 'eliasdlc', repo: 'otro' });

    const despues = await t.query(internal.githubData.systemForSync, { userId, systemId: kino });
    expect(despues.repo).toEqual({ owner: 'eliasdlc', repo: 'otro' });
    expect(despues.syncedThrough).toBeNull();
  });

  it('sin valor, el cursor se queda donde estaba', async () => {
    const { t, userId, kino } = await seed();
    const hasta = Date.now() - 60_000;
    await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: false, syncedThrough: hasta, issues: [issue()] });

    await t.mutation(internal.githubData.applySync, { userId, systemId: kino, truncated: true, issues: [issue()] });

    expect((await t.query(internal.githubData.systemForSync, { userId, systemId: kino })).syncedThrough).toBe(hasta);
  });
});
