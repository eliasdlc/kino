import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');

const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

async function dataOf(promise: Promise<unknown>): Promise<Record<string, unknown>> {
  try {
    await promise;
    return {};
  } catch (error) {
    return error instanceof ConvexError ? (error.data as Record<string, unknown>) : { raw: String(error) };
  }
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error instanceof ConvexError ? (error.data as { code: string }).code : `raw:${String(error)}`;
  }
}

describe('kinoQuery, kinoMutation y kinoAction', () => {
  it('sin identidad devuelven el mismo error tipado', async () => {
    const t = convexTest(schema, modules);
    expect(await codeOf(t.query(api.lib.fnFixture.read, {}))).toBe('UNAUTHENTICATED');
    expect(await codeOf(t.mutation(api.lib.fnFixture.write, {}))).toBe('UNAUTHENTICATED');
    expect(await codeOf(t.action(api.lib.fnFixture.act, {}))).toBe('UNAUTHENTICATED');
  });

  it('el dueño entra con alcance de escritura y su documento se crea una sola vez', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const first = await asAna.mutation(api.lib.fnFixture.write, {});
    const second = await asAna.mutation(api.lib.fnFixture.write, {});
    expect(first).toEqual({ userId: second.userId, scope: 'write' });
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toHaveLength(1);
    expect(await asAna.query(api.lib.fnFixture.read, {})).toEqual(first);
  });

  it('un cliente de solo lectura recibe rechazo en una mutación antes de leer nada', async () => {
    const t = convexTest(schema, modules);
    const reader = t.withIdentity({ ...ana, kino_scope: 'read' });
    expect(await codeOf(reader.mutation(api.lib.fnFixture.write, {}))).toBe('FORBIDDEN_SCOPE');
    expect(await codeOf(reader.mutation(api.lib.fnFixture.propose, {}))).toBe('FORBIDDEN_SCOPE');
    // Ni siquiera se creó su documento: el rechazo llegó antes de la base.
    expect(await t.run((ctx) => ctx.db.query('users').collect())).toHaveLength(0);
  });

  it('proponer alcanza para proponer y no para escribir', async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(ana).mutation(api.lib.fnFixture.write, {});
    const proposer = t.withIdentity({ ...ana, kino_scope: 'propose' });
    expect(await proposer.mutation(api.lib.fnFixture.propose, {})).toMatchObject({ scope: 'propose' });
    expect(await codeOf(proposer.mutation(api.lib.fnFixture.write, {}))).toBe('FORBIDDEN_SCOPE');
  });

  it('una query no crea usuarios: sin documento, NO_USER', async () => {
    const t = convexTest(schema, modules);
    expect(await codeOf(t.withIdentity(ana).query(api.lib.fnFixture.read, {}))).toBe('NO_USER');
  });

  it('una acción lleva su presupuesto y sabe cuánto le queda', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    await asAna.mutation(api.lib.fnFixture.write, {});
    const result = await asAna.action(api.lib.fnFixture.act, { waitMs: 20 });
    expect(result.remainingMs).toBeLessThanOrEqual(30);
  });
});

describe('ninguna función de convex/ sale a pelo', () => {
  const root = __dirname;
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === '_generated' ? [] : files(path);
      return /\.ts$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : [];
    });

  it('query, mutation y action sólo se importan en lib/fn.ts', () => {
    const offenders = files(root).filter((path) => {
      if (path.endsWith('/lib/fn.ts')) return false;
      const source = readFileSync(path, 'utf8');
      const match = source.match(/import\s*\{([^}]*)\}\s*from\s*['"](\.\.?\/)+_generated\/server(\.js)?['"]/);
      if (!match) return false;
      // Las variantes internas no tienen identidad que envolver y quedan fuera.
      return match[1].split(',').some((name) => /^\s*(query|mutation|action)\s*(,|$)/.test(name.trim() + ','));
    });
    expect(offenders.map((path) => path.replace(root, 'convex'))).toEqual([]);
  });
});

describe('el rechazo dice qué sí se puede hacer', () => {
  it('a quien puede proponer, el rechazo de una escritura directa le nombra la propuesta', async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(ana).mutation(api.lib.fnFixture.write, {});

    const datos = await dataOf(t.withIdentity({ ...ana, kino_scope: 'propose' }).mutation(api.lib.fnFixture.write, {}));

    expect(datos.code).toBe('FORBIDDEN_SCOPE');
    // Un 403 seco deja al agente sin más salida que reintentar o rendirse. El
    // principio 2 no es sólo una prohibición: es una redirección.
    expect(datos.salida).toContain('propose_change');
  });

  it('a quien sólo lee, le dice qué alcance le falta y quién se lo da', async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(ana).mutation(api.lib.fnFixture.write, {});

    const datos = await dataOf(t.withIdentity({ ...ana, kino_scope: 'read' }).mutation(api.lib.fnFixture.propose, {}));

    expect(datos.salida).toContain('documents:propose');
    expect(datos.salida).toContain('Quien te autorizó');
  });
});

describe('el cliente OAuth lo pone el servidor', () => {
  it('la propuesta se firma con el cliente del token, no con lo que el agente diga', async () => {
    const t = convexTest(schema, modules);
    const comoAgente = t.withIdentity({ ...ana, kino_scope: 'propose', kino_client: 'claude_desktop' });
    const systemId = await t.withIdentity(ana).mutation(api.systems.create, {
      name: 'Tesis', color: 'blue', templateType: 'project', icon: 'rocket',
    }).then((s) => s.id);
    const tarea = await t.withIdentity(ana).mutation(api.tasks.create, { systemId, title: 'Marco teórico' });

    const { id } = await comoAgente.mutation(api.proposals.create, {
      kind: 'cancel',
      evidenceType: 'task',
      evidenceId: tarea.id,
    });

    const fila = (await t.run((ctx) => ctx.db.query('proposals').collect())).find((p) => p._id === id)!;
    expect(fila.sourceClientId).toBe('claude_desktop');
  });

  it('el log guarda el cliente sin que ninguna llamada se lo pase', async () => {
    const t = convexTest(schema, modules);
    const comoAgente = t.withIdentity({ ...ana, kino_client: 'claude_code' });
    const systemId = await comoAgente.mutation(api.systems.create, {
      name: 'Tesis', color: 'blue', templateType: 'project', icon: 'rocket',
    }).then((s) => s.id);

    await comoAgente.mutation(api.tasks.create, { systemId, title: 'Del agente' });

    const filas = await t.run((ctx) => ctx.db.query('eventLog').collect());
    expect(filas.every((f) => f.clientId === 'claude_code')).toBe(true);
  });

  it('desde el navegador no hay cliente que guardar', async () => {
    const t = convexTest(schema, modules);
    const asAna = t.withIdentity(ana);
    const systemId = await asAna.mutation(api.systems.create, {
      name: 'Tesis', color: 'blue', templateType: 'project', icon: 'rocket',
    }).then((s) => s.id);

    await asAna.mutation(api.tasks.create, { systemId, title: 'Mía' });

    const filas = await t.run((ctx) => ctx.db.query('eventLog').collect());
    expect(filas.every((f) => f.clientId === undefined)).toBe(true);
  });
});
