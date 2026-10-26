/**
 * Qué se prueba: que Kino anota qué clientes del conector llamaron (una fila
 * por persona y cliente, con a lo sumo una escritura cada cinco minutos), que
 * desconectar corta de verdad, y que la tabla no crece sin techo.
 *
 * «Corta de verdad» son dos puertas: `registrar` dice `revocado` para que la
 * ruta de Next conteste 403 antes de montar nada, y el envoltorio de `lib/fn.ts`
 * lanza `REVOKED` en cada función que un token del conector llame, incluso uno
 * acuñado antes de la revocación. El servicio es el `sub` que firma la ruta; el
 * conector lleva el `kino_client` que Clerk verificó.
 */

import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { MCP_CLIENTS_ACTIVE_CAP, MCP_CLIENTS_SUBJECT, REGISTRAR_CADA_MS } from './lib/mcpClients';
import { MCP_TOKEN_ISSUER } from './lib/mcpToken';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');

const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };
const beto = { subject: 'user_beto', email: 'beto@usekino.dev', name: 'Beto' };
const servicio = { issuer: MCP_TOKEN_ISSUER, subject: MCP_CLIENTS_SUBJECT };
/** Un token del conector de Ana, como lo firma la ruta tras verificar a Clerk. */
const conector = (kino_client: string, persona = ana) => ({
  ...persona,
  issuer: MCP_TOKEN_ISSUER,
  kino_scope: 'write',
  kino_client,
});

const T0 = Date.UTC(2026, 9, 26, 12, 0, 0);

const nuevoT = () => convexTest(schema, modules);
let t: ReturnType<typeof nuevoT>;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  t = nuevoT();
  // Las dos personas existen: la fila de `users` nace con su primera mutación.
  await t.withIdentity(ana).mutation(api.lib.fnFixture.write, {});
  await t.withIdentity(beto).mutation(api.lib.fnFixture.write, {});
});

afterEach(() => {
  vi.useRealTimers();
});

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error instanceof ConvexError ? (error.data as { code: string }).code : `raw:${String(error)}`;
  }
}

const filas = () => t.run((ctx) => ctx.db.query('mcpClients').collect());

const registrar = (clientId: string, extra: { scope?: 'read' | 'propose' | 'write'; clientName?: string; clerkId?: string } = {}) =>
  t.withIdentity(servicio).mutation(api.mcpClients.registrar, {
    clerkId: extra.clerkId ?? ana.subject,
    clientId,
    scope: extra.scope ?? 'write',
    clientName: extra.clientName,
  });

const userId = (persona: { subject: string }) =>
  t.run(async (ctx) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', persona.subject))
      .unique();
    return user!._id;
  });

/** Siembra un cliente directo en la tabla, sin pasar por `registrar`. */
async function sembrar(persona: { subject: string }, clientId: string, lastSeenAt: number, revokedAt?: number) {
  const dueño = await userId(persona);
  return t.run((ctx) =>
    ctx.db.insert('mcpClients', {
      userId: dueño,
      clientId,
      kind: 'otro',
      label: clientId,
      scope: 'write',
      firstSeenAt: lastSeenAt,
      lastSeenAt,
      ...(revokedAt === undefined ? {} : { revokedAt }),
    }),
  );
}

describe('mcpClients.registrar', () => {
  it('la primera llamada inserta, otra dentro de cinco minutos no escribe, y una pasados cinco minutos parchea lastSeenAt', async () => {
    expect(await registrar('c1', { clientName: 'claude-code' })).toEqual({ revocado: false });
    const [primera] = await filas();
    expect(primera).toMatchObject({ clientId: 'c1', kind: 'claude-code', label: 'Claude Code', scope: 'write', firstSeenAt: T0, lastSeenAt: T0 });

    vi.setSystemTime(T0 + REGISTRAR_CADA_MS - 1);
    expect(await registrar('c1', { clientName: 'claude-code' })).toEqual({ revocado: false });
    expect(await filas()).toEqual([primera]);

    vi.setSystemTime(T0 + REGISTRAR_CADA_MS);
    await registrar('c1', { clientName: 'claude-code' });
    expect(await filas()).toEqual([{ ...primera, lastSeenAt: T0 + REGISTRAR_CADA_MS }]);
  });

  it('un cambio de alcance se escribe sin esperar los cinco minutos', async () => {
    await registrar('c1', { scope: 'read' });
    vi.setSystemTime(T0 + 1_000);
    await registrar('c1', { scope: 'write' });
    expect(await filas()).toMatchObject([{ scope: 'write', lastSeenAt: T0 + 1_000 }]);
  });

  it('la etiqueta sin nombre se completa cuando llega el nombre, y una llamada sin nombre no la pisa', async () => {
    await registrar('c1');
    expect(await filas()).toMatchObject([{ kind: 'otro', label: 'Cliente sin nombre' }]);

    vi.setSystemTime(T0 + 1_000);
    await registrar('c1', { clientName: 'codex-mcp-client' });
    expect(await filas()).toMatchObject([{ kind: 'codex', label: 'Codex de OpenAI', lastSeenAt: T0 + 1_000 }]);

    // Codex manda su nombre solo en `initialize`: las demás llamadas llegan sin él.
    vi.setSystemTime(T0 + REGISTRAR_CADA_MS + 1_000);
    await registrar('c1');
    expect(await filas()).toMatchObject([{ kind: 'codex', label: 'Codex de OpenAI' }]);
  });

  it('sin documento users (onboarding sin terminar) no escribe nada y no revoca', async () => {
    expect(await registrar('c1', { clerkId: 'user_sin_cuenta' })).toEqual({ revocado: false });
    expect(await filas()).toEqual([]);
  });

  it('cada persona tiene su fila para el mismo client_id', async () => {
    await registrar('c1');
    await registrar('c1', { clerkId: beto.subject });
    expect(await filas()).toHaveLength(2);
  });

  it('sólo lo llama el servidor de Kino: ni una sesión ni un conector', async () => {
    const args = { clerkId: ana.subject, clientId: 'c1', scope: 'write' as const };

    expect(await codeOf(t.mutation(api.mcpClients.registrar, args))).toBe('UNAUTHENTICATED');
    expect(await codeOf(t.withIdentity(ana).mutation(api.mcpClients.registrar, args))).toBe('FORBIDDEN_SCOPE');
    expect(await codeOf(t.withIdentity(conector('c1')).mutation(api.mcpClients.registrar, args))).toBe('FORBIDDEN_SCOPE');
    expect(await filas()).toEqual([]);
  });
});

describe('mcpClients.desconectar', () => {
  it('sólo la sesión del navegador: un conector, ni con write, falla FORBIDDEN_SCOPE', async () => {
    await registrar('c1');
    const [fila] = await filas();

    expect(await codeOf(t.withIdentity(conector('c1')).mutation(api.mcpClients.desconectar, { id: fila._id }))).toBe('FORBIDDEN_SCOPE');
    expect(await codeOf(t.mutation(api.mcpClients.desconectar, { id: fila._id }))).toBe('UNAUTHENTICATED');
    expect((await filas())[0].revokedAt).toBeUndefined();
  });

  it('Beto no puede desconectar el cliente de Ana: NOT_FOUND, y la fila sigue activa', async () => {
    await registrar('c1');
    const [fila] = await filas();

    expect(await codeOf(t.withIdentity(beto).mutation(api.mcpClients.desconectar, { id: fila._id }))).toBe('NOT_FOUND');
    expect((await filas())[0].revokedAt).toBeUndefined();
  });

  it('Ana lo desconecta, y desconectar otra vez no cambia la fecha', async () => {
    await registrar('c1');
    const [fila] = await filas();
    const asAna = t.withIdentity(ana);

    vi.setSystemTime(T0 + 10_000);
    await asAna.mutation(api.mcpClients.desconectar, { id: fila._id });
    expect((await filas())[0].revokedAt).toBe(T0 + 10_000);

    vi.setSystemTime(T0 + 20_000);
    await asAna.mutation(api.mcpClients.desconectar, { id: fila._id });
    expect((await filas())[0].revokedAt).toBe(T0 + 10_000);
  });

  it('un id que no existe (borrado) es NOT_FOUND', async () => {
    const fila = await sembrar(ana, 'c1', T0);
    await t.run((ctx) => ctx.db.delete(fila));
    expect(await codeOf(t.withIdentity(ana).mutation(api.mcpClients.desconectar, { id: fila }))).toBe('NOT_FOUND');
  });
});

describe('un cliente desconectado', () => {
  async function desconectado() {
    await registrar('c1');
    const [fila] = await filas();
    await t.withIdentity(ana).mutation(api.mcpClients.desconectar, { id: fila._id });
    return fila._id;
  }

  it('registrar dice revocado y no escribe nada', async () => {
    await desconectado();
    const antes = await filas();

    vi.setSystemTime(T0 + 2 * REGISTRAR_CADA_MS);
    expect(await registrar('c1', { scope: 'read', clientName: 'codex-mcp-client' })).toEqual({ revocado: true });
    expect(await filas()).toEqual(antes);
  });

  it('una query llamada con su token falla REVOKED, aunque el token sea anterior; con otro cliente o desde el navegador pasa', async () => {
    const conTokenViejo = t.withIdentity(conector('c1'));
    // El token se acuñó y funcionaba antes de desconectar.
    expect(await conTokenViejo.query(api.systems.list, {})).toEqual([]);

    await desconectado();

    expect(await codeOf(conTokenViejo.query(api.systems.list, {}))).toBe('REVOKED');
    expect(await t.withIdentity(conector('c2')).query(api.systems.list, {})).toEqual([]);
    expect(await t.withIdentity(ana).query(api.systems.list, {})).toEqual([]);
  });

  it('una mutación y una acción con su token también fallan REVOKED', async () => {
    await desconectado();
    const conToken = t.withIdentity(conector('c1'));

    expect(await codeOf(conToken.mutation(api.lib.fnFixture.write, {}))).toBe('REVOKED');
    expect(await codeOf(conToken.action(api.lib.fnFixture.act, {}))).toBe('REVOKED');
    // Otro cliente de la misma persona sigue entrando por las dos puertas.
    expect(await t.withIdentity(conector('c2')).mutation(api.lib.fnFixture.write, {})).toMatchObject({ scope: 'write' });
    expect(await t.withIdentity(conector('c2')).action(api.lib.fnFixture.act, {})).toMatchObject({});
  });

  it('la revocación es de una persona: el mismo client_id de Beto sigue entrando', async () => {
    await desconectado();
    expect(await t.withIdentity(conector('c1', beto)).query(api.systems.list, {})).toEqual([]);
    expect(await registrar('c1', { clerkId: beto.subject })).toEqual({ revocado: false });
  });
});

describe('mcpClients.list', () => {
  it('separa activos de revocados, del más reciente al más antiguo, y nunca devuelve el clientId', async () => {
    const secreto = 'client_id_que_no_sale';
    await sembrar(ana, `${secreto}_a`, T0 - 3_000);
    await sembrar(ana, `${secreto}_b`, T0 - 1_000);
    await sembrar(ana, `${secreto}_c`, T0 - 5_000, T0 - 500);
    await sembrar(ana, `${secreto}_d`, T0 - 4_000, T0 - 100);
    await sembrar(beto, `${secreto}_beto`, T0);

    const { activos, revocados } = await t.withIdentity(ana).query(api.mcpClients.list, {});

    expect(activos.map((c) => c.label)).toEqual([`${secreto}_b`, `${secreto}_a`]);
    expect(revocados.map((c) => c.label)).toEqual([`${secreto}_d`, `${secreto}_c`]);
    expect(revocados.map((c) => c.revokedAt)).toEqual([T0 - 100, T0 - 500]);
    expect(activos[0]).toEqual({ _id: expect.any(String), kind: 'otro', label: `${secreto}_b`, scope: 'write', lastSeenAt: T0 - 1_000 });
    expect(JSON.stringify({ activos, revocados })).not.toContain('clientId');
    expect(JSON.stringify({ activos, revocados })).not.toContain('beto');
  });

  it('una persona sin clientes recibe las dos listas vacías', async () => {
    expect(await t.withIdentity(ana).query(api.mcpClients.list, {})).toEqual({ activos: [], revocados: [] });
  });
});

describe('el techo de clientes', () => {
  it(`el cliente ${MCP_CLIENTS_ACTIVE_CAP + 1} saca al activo más antiguo y nunca a un revocado`, async () => {
    // Un revocado más antiguo que todos: si la poda mirara solo `lastSeenAt`, sería el primero en salir.
    await sembrar(ana, 'revocado', T0 - 10_000, T0 - 9_000);
    for (let i = 0; i < MCP_CLIENTS_ACTIVE_CAP; i++) await sembrar(ana, `activo_${i}`, T0 - 5_000 + i);
    await sembrar(beto, 'de_beto', T0 - 20_000);

    await registrar('nuevo', { clientName: 'claude-code' });

    const nombres = (await filas()).map((c) => c.clientId);
    expect(nombres).not.toContain('activo_0');
    expect(nombres).toContain('activo_1');
    expect(nombres).toContain('nuevo');
    expect(nombres).toContain('revocado');
    expect(nombres).toContain('de_beto');
    expect((await t.withIdentity(ana).query(api.mcpClients.list, {})).activos).toHaveLength(MCP_CLIENTS_ACTIVE_CAP);
  });

  it('por debajo del techo no saca a nadie', async () => {
    for (let i = 0; i < MCP_CLIENTS_ACTIVE_CAP - 1; i++) await sembrar(ana, `activo_${i}`, T0 - 5_000 + i);
    await registrar('nuevo');
    expect(await filas()).toHaveLength(MCP_CLIENTS_ACTIVE_CAP);
  });

  it('el cliente que salió por el techo y vuelve a llamar entra como activo', async () => {
    for (let i = 0; i < MCP_CLIENTS_ACTIVE_CAP; i++) await sembrar(ana, `activo_${i}`, T0 - 5_000 + i);
    await registrar('nuevo');
    expect((await filas()).map((c) => c.clientId)).not.toContain('activo_0');

    expect(await registrar('activo_0')).toEqual({ revocado: false });
    expect((await filas()).map((c) => c.clientId)).toContain('activo_0');
    expect((await t.withIdentity(ana).query(api.mcpClients.list, {})).activos).toHaveLength(MCP_CLIENTS_ACTIVE_CAP);
  });
});

describe('las tablas que acompañan a mcpClients', () => {
  it('borrar la cuenta se lleva sus clientes, revocados incluidos, y deja los de otra persona', async () => {
    await sembrar(ana, 'activo', T0);
    await sembrar(ana, 'revocado', T0, T0);
    await sembrar(beto, 'de_beto', T0);

    await t.mutation(internal.users.purge, { userId: (await userId(ana)) as Id<'users'> });

    expect((await filas()).map((c) => c.clientId)).toEqual(['de_beto']);
  });
});
