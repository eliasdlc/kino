/**
 * Qué se prueba: que una tarea creada desde una carpeta cae en el sistema que
 * la persona asignó a esa carpeta sin que el agente lo nombre, que la regla
 * más profunda gana y las subcarpetas heredan comparando por segmentos, que
 * una carpeta sin regla no crea nada y pide preguntar, y que la regla de una
 * persona nunca decide por otra.
 */
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { MCP_TOKEN_ISSUER } from './lib/mcpToken';
import { WORKDIR_RULES_MAX } from './lib/workdir';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');
const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const beto = { subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' };

/** El conector de esa persona: la vía por la que llega create_task. */
const agenteDe = (t: ReturnType<typeof convexTest>, quien: typeof ana) =>
  t.withIdentity({ ...quien, issuer: MCP_TOKEN_ISSUER, kino_scope: 'write', kino_client: 'claude_code' });

async function cuenta(t: ReturnType<typeof convexTest>, quien: typeof ana, sistemas: string[]) {
  const sesion = t.withIdentity(quien);
  await sesion.mutation(api.users.ensure, {});
  await sesion.mutation(api.systems.setup, {});
  const ids: Record<string, Id<'systems'>> = {};
  for (const name of sistemas) ids[name] = (await sesion.mutation(api.systems.create, { name, color: 'blue' })).id;
  return { agente: agenteDe(t, quien), ids };
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error instanceof ConvexError ? (error.data as { code: string }).code : `raw:${String(error)}`;
  }
}

describe('una carpeta con regla', () => {
  it('la tarea cae en el sistema de la carpeta sin nombrarlo', async () => {
    const t = convexTest(schema, modules);
    const { agente, ids } = await cuenta(t, ana, ['Universidad']);
    await agente.mutation(api.workdirRules.save, { systemId: ids.Universidad!, workingDirectory: '/home/ana/Documents/Universidad' });

    const res = await agente.mutation(api.tasks.createFromAgent, { title: 'Leer el capítulo 3', workingDirectory: '/home/ana/Documents/Universidad' });

    expect(res).toMatchObject({ status: 'created', routedBy: 'rule', rule: { kind: 'path', key: '/home/ana/Documents/Universidad', systemName: 'Universidad' } });
    expect(res.status === 'created' && res.task.systemId).toBe(ids.Universidad);
  });

  it('las subcarpetas heredan, y la regla más profunda gana', async () => {
    const t = convexTest(schema, modules);
    const { agente, ids } = await cuenta(t, ana, ['Universidad', 'Tesis']);
    await agente.mutation(api.workdirRules.save, { systemId: ids.Universidad!, workingDirectory: '/home/ana/Documents/Universidad' });
    await agente.mutation(api.workdirRules.save, { systemId: ids.Tesis!, workingDirectory: '/home/ana/Documents/Universidad/Tesis' });

    const sistemaDe = async (workingDirectory: string) => {
      const res = await agente.mutation(api.tasks.createFromAgent, { title: 'x', workingDirectory });
      return res.status === 'created' ? res.task.systemId : res.status;
    };

    expect(await sistemaDe('/home/ana/Documents/Universidad/Calculo/tema1')).toBe(ids.Universidad);
    expect(await sistemaDe('/home/ana/Documents/Universidad/Tesis/capitulos')).toBe(ids.Tesis);
    expect(await sistemaDe('/home/ana/Documents/Universidad/Tesis')).toBe(ids.Tesis);
  });

  it('compara por segmentos: /a/Uni no cubre /a/Universidad', async () => {
    const t = convexTest(schema, modules);
    const { agente, ids } = await cuenta(t, ana, ['Uni']);
    await agente.mutation(api.workdirRules.save, { systemId: ids.Uni!, workingDirectory: '/a/Uni' });

    const res = await agente.mutation(api.tasks.createFromAgent, { title: 'x', workingDirectory: '/a/Universidad' });

    expect(res).toEqual({ status: 'needs_system', workingDirectory: '/a/Universidad', gitRemote: null });
  });

  it('la barra final no cambia la carpeta, ni al guardar ni al buscar', async () => {
    const t = convexTest(schema, modules);
    const { agente, ids } = await cuenta(t, ana, ['Universidad']);
    const guardada = await agente.mutation(api.workdirRules.save, { systemId: ids.Universidad!, workingDirectory: '/home/ana/Universidad/' });

    const res = await agente.mutation(api.tasks.createFromAgent, { title: 'x', workingDirectory: '/home/ana//Universidad' });

    expect(guardada.key).toBe('/home/ana/Universidad');
    expect(res.status === 'created' && res.task.systemId).toBe(ids.Universidad);
  });

  it('el repo manda sobre la carpeta y vale en cualquier clon', async () => {
    const t = convexTest(schema, modules);
    const { agente, ids } = await cuenta(t, ana, ['Trabajo', 'Kino']);
    await agente.mutation(api.workdirRules.save, { systemId: ids.Trabajo!, workingDirectory: '/home/ana/dev' });
    await agente.mutation(api.workdirRules.save, { systemId: ids.Kino!, gitRemote: 'git@github.com:eliasdlc/kino.git' });

    const res = await agente.mutation(api.tasks.createFromAgent, {
      title: 'x',
      workingDirectory: '/home/ana/dev/wt/kino/otra-rama',
      gitRemote: 'https://github.com/eliasdlc/Kino',
    });

    expect(res).toMatchObject({ status: 'created', routedBy: 'rule', rule: { kind: 'repo', key: 'github.com/eliasdlc/kino' } });
    expect(res.status === 'created' && res.task.systemId).toBe(ids.Kino);
  });

  it('el sistema que el agente nombra manda sobre la regla', async () => {
    const t = convexTest(schema, modules);
    const { agente, ids } = await cuenta(t, ana, ['Universidad', 'Casa']);
    await agente.mutation(api.workdirRules.save, { systemId: ids.Universidad!, workingDirectory: '/home/ana/Universidad' });

    const res = await agente.mutation(api.tasks.createFromAgent, { title: 'x', systemId: ids.Casa!, workingDirectory: '/home/ana/Universidad' });

    expect(res).toMatchObject({ status: 'created', routedBy: 'systemId' });
    expect(res.status === 'created' && res.task.systemId).toBe(ids.Casa);
  });

  it('guardar otra vez la misma carpeta le cambia el sistema, no la duplica', async () => {
    const t = convexTest(schema, modules);
    const { agente, ids } = await cuenta(t, ana, ['Universidad', 'Tesis']);
    await agente.mutation(api.workdirRules.save, { systemId: ids.Universidad!, workingDirectory: '/home/ana/U' });
    const segunda = await agente.mutation(api.workdirRules.save, { systemId: ids.Tesis!, workingDirectory: '/home/ana/U/' });

    expect(segunda).toMatchObject({ replaced: true, systemName: 'Tesis' });
    expect(await t.run((ctx) => ctx.db.query('workdirRules').collect())).toHaveLength(1);
  });
});

describe('una carpeta sin regla', () => {
  it('no crea nada y devuelve la carpeta normalizada para preguntar', async () => {
    const t = convexTest(schema, modules);
    const { agente } = await cuenta(t, ana, ['Universidad']);

    const res = await agente.mutation(api.tasks.createFromAgent, { title: 'x', workingDirectory: '/home/ana/nueva/', gitRemote: 'https://github.com/ana/nueva.git' });

    expect(res).toEqual({ status: 'needs_system', workingDirectory: '/home/ana/nueva', gitRemote: 'github.com/ana/nueva' });
    expect(await t.run((ctx) => ctx.db.query('tasks').collect())).toHaveLength(0);
  });

  it('una ruta que no es absoluta es un error, no la Bandeja', async () => {
    const t = convexTest(schema, modules);
    const { agente } = await cuenta(t, ana, []);

    expect(await codeOf(agente.mutation(api.tasks.createFromAgent, { title: 'x', workingDirectory: '~/Documents' }))).toBe('VALIDATION_ERROR');
    expect(await t.run((ctx) => ctx.db.query('tasks').collect())).toHaveLength(0);
  });

  it('sin carpeta ni sistema, va a la Bandeja', async () => {
    const t = convexTest(schema, modules);
    const { agente } = await cuenta(t, ana, ['Universidad']);

    const res = await agente.mutation(api.tasks.createFromAgent, { title: 'x' });

    expect(res).toMatchObject({ status: 'created', routedBy: 'inbox' });
    const sistema = await t.run(async (ctx) => (res.status === 'created' ? ctx.db.get(res.task.systemId) : null));
    expect(sistema?.isInbox).toBe(true);
  });

  it('la regla de un sistema archivado no cuenta', async () => {
    const t = convexTest(schema, modules);
    const { agente, ids } = await cuenta(t, ana, ['Viejo']);
    await agente.mutation(api.workdirRules.save, { systemId: ids.Viejo!, workingDirectory: '/home/ana/viejo' });
    await t.run((ctx) => ctx.db.patch(ids.Viejo!, { isActive: false }));

    const res = await agente.mutation(api.tasks.createFromAgent, { title: 'x', workingDirectory: '/home/ana/viejo' });

    expect(res.status).toBe('needs_system');
  });
});

describe('cada persona, sus reglas', () => {
  it('la regla de Beto para la misma carpeta nunca decide por Ana', async () => {
    const t = convexTest(schema, modules);
    const deAna = await cuenta(t, ana, []);
    const deBeto = await cuenta(t, beto, ['Universidad']);
    await deBeto.agente.mutation(api.workdirRules.save, { systemId: deBeto.ids.Universidad!, workingDirectory: '/home/compartida/Universidad' });

    const res = await deAna.agente.mutation(api.tasks.createFromAgent, { title: 'x', workingDirectory: '/home/compartida/Universidad' });

    expect(res.status).toBe('needs_system');
  });

  it('nadie guarda una regla hacia el sistema de otro', async () => {
    const t = convexTest(schema, modules);
    const deAna = await cuenta(t, ana, []);
    const deBeto = await cuenta(t, beto, ['Universidad']);

    expect(await codeOf(deAna.agente.mutation(api.workdirRules.save, { systemId: deBeto.ids.Universidad!, workingDirectory: '/home/ana' }))).toBe('NOT_FOUND');
    expect(await t.run((ctx) => ctx.db.query('workdirRules').collect())).toHaveLength(0);
  });

  it(`una persona tiene como mucho ${WORKDIR_RULES_MAX} reglas`, async () => {
    const t = convexTest(schema, modules);
    const { agente, ids } = await cuenta(t, ana, ['Universidad']);
    await t.run(async (ctx) => {
      const userId = (await ctx.db.get(ids.Universidad!))!.userId;
      for (let n = 0; n < WORKDIR_RULES_MAX; n++) {
        await ctx.db.insert('workdirRules', { userId, kind: 'path', key: `/r/${n}`, systemId: ids.Universidad!, createdBy: userId, createdVia: 'oauth', createdAt: 0, updatedAt: 0 });
      }
    });

    expect(await codeOf(agente.mutation(api.workdirRules.save, { systemId: ids.Universidad!, workingDirectory: '/r/nueva' }))).toBe('VALIDATION_ERROR');
    // Reasignar una que ya existe no suma.
    expect((await agente.mutation(api.workdirRules.save, { systemId: ids.Universidad!, workingDirectory: '/r/0' })).replaced).toBe(true);
  });
});
