/**
 * La migración que baja el cursor de GitHub de la cuenta al sistema. Lo que
 * decide no es que haya cursor guardado, sino que se pueda atribuir: con un
 * solo repositorio enlazado el cursor de la cuenta era el de ese sistema, y con
 * dos no hay dato que diga de cuál era.
 */
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { cursorDelSistema } from './migrations/cursorPorSistema';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

const CURSOR = Date.UTC(2026, 8, 1);

/** Una cuenta con conexión de GitHub y los repositorios que se le pidan. */
async function seed(repos: string[], opciones: { cursor?: number } = {}) {
  const t = convexTest(schema, modules);
  const asAna = t.withIdentity(ana);
  const userId = await asAna.mutation(api.users.ensure, {});
  const ids: Id<'systems'>[] = [];
  for (const repo of repos) {
    const sistema = await asAna.mutation(api.systems.create, { name: repo, color: 'blue', templateType: 'project', icon: 'rocket' });
    await t.run((ctx) => ctx.db.patch(sistema.id, { metadata: { github: { owner: 'eliasdlc', repo } } }));
    ids.push(sistema.id);
  }
  await t.run((ctx) =>
    ctx.db.insert('syncConnections', {
      userId,
      provider: 'github',
      accessTokenEncrypted: 'cifrado',
      syncedThrough: opciones.cursor,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  // `undefined` es «a este no le toca nada»; se normaliza a null porque es lo
  // que `t.run` devuelve al cruzar la frontera de la función.
  const parcheDe = (id: Id<'systems'>) => t.run(async (ctx) => (await cursorDelSistema(ctx, (await ctx.db.get(id))!)) ?? null);
  return { t, userId, ids, parcheDe };
}

describe('el cursor de GitHub baja de la cuenta al sistema', () => {
  it('con un solo repositorio enlazado, el sistema hereda el cursor de la cuenta', async () => {
    const { ids, parcheDe } = await seed(['kino'], { cursor: CURSOR });

    expect(await parcheDe(ids[0])).toEqual({ metadata: { github: { owner: 'eliasdlc', repo: 'kino', syncedThrough: CURSOR } } });
  });

  it('con dos, ninguno lo hereda: el cursor no se puede atribuir y los dos refrescan enteros', async () => {
    const { ids, parcheDe } = await seed(['kino', 'conocerd'], { cursor: CURSOR });

    expect(await parcheDe(ids[0])).toBeNull();
    expect(await parcheDe(ids[1])).toBeNull();
  });

  it('un sistema que ya tiene cursor no se toca: la segunda pasada no escribe nada', async () => {
    const { t, ids, parcheDe } = await seed(['kino'], { cursor: CURSOR });
    await t.run((ctx) => ctx.db.patch(ids[0], { metadata: { github: { owner: 'eliasdlc', repo: 'kino', syncedThrough: 1 } } }));

    expect(await parcheDe(ids[0])).toBeNull();
  });

  it('sin cursor en la conexión no hay nada que bajar', async () => {
    const { ids, parcheDe } = await seed(['kino']);

    expect(await parcheDe(ids[0])).toBeNull();
  });

  it('un sistema sin repositorio enlazado se queda como está', async () => {
    const { t, parcheDe } = await seed(['kino'], { cursor: CURSOR });
    const suelto = await t.withIdentity(ana).mutation(api.systems.create, { name: 'Sin repo', color: 'green', templateType: 'project', icon: 'map' });

    expect(await parcheDe(suelto.id)).toBeNull();
  });
});
