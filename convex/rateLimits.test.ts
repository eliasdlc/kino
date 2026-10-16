/**
 * Qué se prueba: que el contador del rate limit es uno solo para todas las
 * instancias de Next, y que sobrevive a que el proceso se reinicie.
 *
 * Una «instancia» aquí es el módulo del limitador cargado de nuevo con
 * `vi.resetModules()`: el mismo código con la memoria del proceso a cero, que
 * es lo que Vercel arranca en cada instancia y en cada arranque en frío. El
 * proxy llama a Convex con `fetchMutation`; el mock lo dirige a `convex-test`
 * con la identidad que lleva el token firmado, así que la puerta del servicio
 * se recorre de verdad.
 */

import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { decodeJwt, exportJWK, generateKeyPair } from 'jose';
import { NextRequest } from 'next/server';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './_generated/api';
import { MCP_TOKEN_ISSUER, RATE_LIMIT_SUBJECT } from './lib/mcpToken';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');

let t: ReturnType<typeof convexTest>;
/** Convex que acepta la conexión y no contesta nunca. */
let colgado = false;

vi.mock('convex/nextjs', () => ({
  fetchMutation: (ref: Parameters<typeof t.mutation>[0], args: Record<string, unknown>, options: { token: string }) => {
    if (colgado) return new Promise(() => {});
    const claims = decodeJwt(options.token);
    return t.withIdentity({ issuer: claims.iss, subject: claims.sub }).mutation(ref, args);
  },
}));

beforeAll(async () => {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  process.env.KINO_MCP_SIGNING_JWK = JSON.stringify(await exportJWK(privateKey));
});

beforeEach(() => {
  t = convexTest(schema, modules);
  colgado = false;
});

/** Una instancia nueva: el limitador recién cargado, sin nada en memoria. */
async function instancia() {
  vi.resetModules();
  const { guardApiRequest, MCP_POLICY } = await import('@/shared/rate-limit');
  return { guardApiRequest, MCP_POLICY };
}

const API_KEY = 'sk-kino-abcdefghijklmnopqrstuvwxyz';
const NOW = 1_000_000;

function mcpRequest(): NextRequest {
  return new NextRequest('http://localhost/api/mcp', {
    method: 'POST',
    headers: { authorization: `Bearer ${API_KEY}` },
  });
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error instanceof ConvexError ? (error.data as { code: string }).code : `raw:${String(error)}`;
  }
}

describe('el contador compartido', () => {
  it('dos instancias suman sobre el mismo contador', async () => {
    const a = await instancia();
    const b = await instancia();

    // La cuota entera repartida entre las dos: cada una por sí sola va por la mitad.
    for (let i = 0; i < a.MCP_POLICY.limit; i++) {
      const guard = i % 2 === 0 ? a.guardApiRequest : b.guardApiRequest;
      expect(await guard(mcpRequest(), { now: NOW })).toBeNull();
    }

    const res = await b.guardApiRequest(mcpRequest(), { now: NOW });
    expect(res?.status).toBe(429);
  });

  it('el límite sigue después de que el proceso se reinicie', async () => {
    const antes = await instancia();
    for (let i = 0; i < antes.MCP_POLICY.limit; i++) {
      expect(await antes.guardApiRequest(mcpRequest(), { now: NOW })).toBeNull();
    }

    const despues = await instancia();
    const res = await despues.guardApiRequest(mcpRequest(), { now: NOW });
    expect(res?.status).toBe(429);
  });
});

describe('si Convex no contesta', () => {
  it('deja pasar al cumplirse el tope en vez de colgar la request', async () => {
    const { guardApiRequest } = await instancia();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    colgado = true;
    try {
      let resultado: Response | null | undefined;
      const pendiente = guardApiRequest(mcpRequest(), { now: NOW }).then((r) => (resultado = r));
      // El hash de la credencial y la firma del token van por WebCrypto, que no
      // obedece al reloj falso: se avanza a pasos hasta que la request vuelve.
      // Sin tope de pasos: en una máquina lenta el reloj del tope se crea tarde,
      // y si el bucle dejara de avanzar antes, ese reloj no sonaría nunca. El
      // límite lo pone el timeout del test, que es la señal correcta si cuelga.
      let avanzado = 0;
      while (resultado === undefined) {
        await vi.advanceTimersByTimeAsync(100);
        avanzado += 100;
      }
      await pendiente;
      expect(resultado).toBeNull();
      expect(avanzado).toBeGreaterThanOrEqual(1_500);
      expect(consoleError).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      consoleError.mockRestore();
    }
  });
});

describe('rateLimits.hit', () => {
  const servicio = { issuer: MCP_TOKEN_ISSUER, subject: RATE_LIMIT_SUBJECT };
  const args = { identity: 'key:abc', bucket: 'mcp', windowStart: 960_000 };

  it('sólo lo llama el servidor de Kino: ni una sesión ni un conector', async () => {
    const ana = { subject: 'user_ana', email: 'ana@usekino.dev', name: 'Ana' };

    expect(await codeOf(t.mutation(api.rateLimits.hit, args))).toBe('UNAUTHENTICATED');
    expect(await codeOf(t.withIdentity(ana).mutation(api.rateLimits.hit, args))).toBe('FORBIDDEN_SCOPE');
    expect(
      await codeOf(
        t.withIdentity({ ...ana, issuer: MCP_TOKEN_ISSUER, kino_scope: 'write' }).mutation(api.rateLimits.hit, args),
      ),
    ).toBe('FORBIDDEN_SCOPE');
    expect(await t.run((ctx) => ctx.db.query('rateLimits').collect())).toHaveLength(0);
  });

  it('vuelve a 1 cuando cambia la ventana, sobre la misma fila', async () => {
    const llamar = t.withIdentity(servicio);
    expect(await llamar.mutation(api.rateLimits.hit, args)).toBe(1);
    expect(await llamar.mutation(api.rateLimits.hit, args)).toBe(2);
    expect(await llamar.mutation(api.rateLimits.hit, { ...args, windowStart: 1_020_000 })).toBe(1);
    expect(await t.run((ctx) => ctx.db.query('rateLimits').collect())).toHaveLength(1);
  });

  it('borra de paso las filas que ya no cuentan para nadie, y sólo esas', async () => {
    const hora = 60 * 60 * 1000;
    const ahora = 10 * hora;
    await t.run(async (ctx) => {
      await ctx.db.insert('rateLimits', { identity: 'sess:vieja', bucket: 'mutation', windowStart: ahora - 2 * hora, hits: 3 });
      await ctx.db.insert('rateLimits', { identity: 'sess:reciente', bucket: 'mutation', windowStart: ahora - 60_000, hits: 3 });
    });

    await t.withIdentity(servicio).mutation(api.rateLimits.hit, { ...args, windowStart: ahora });

    const quedan = await t.run((ctx) => ctx.db.query('rateLimits').collect());
    expect(quedan.map((fila) => fila.identity).sort()).toEqual(['key:abc', 'sess:reciente']);
  });
});
