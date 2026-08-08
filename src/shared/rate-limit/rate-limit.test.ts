import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  decide,
  enforceRateLimit,
  guardApiRequest,
  MCP_POLICY,
  MUTATION_POLICY,
  policyFor,
  rateLimitedResponse,
  windowStartFor,
  type RateLimitPolicy,
  type RateLimitStore,
} from '@/shared/rate-limit';

const POLICY: RateLimitPolicy = { bucket: 'test', limit: 3, windowMs: 60_000 };

/**
 * Réplica en memoria del contador de Postgres: misma semántica de ventana fija
 * (suma si el `windowStart` coincide, resetea a 1 si cambió), sin base de datos.
 */
function fakeStore(): RateLimitStore & { rows: Map<string, { windowStart: number; hits: number }> } {
  const rows = new Map<string, { windowStart: number; hits: number }>();
  return {
    rows,
    async hit(identity, bucket, windowStart) {
      const key = `${identity}|${bucket}`;
      const row = rows.get(key);
      const next =
        row && row.windowStart === windowStart.getTime()
          ? { windowStart: row.windowStart, hits: row.hits + 1 }
          : { windowStart: windowStart.getTime(), hits: 1 };
      rows.set(key, next);
      return next.hits;
    },
  };
}

describe('windowStartFor', () => {
  it('alinea la ventana a múltiplos de windowMs', () => {
    expect(windowStartFor(60_000, 60_000)).toBe(60_000);
    expect(windowStartFor(119_999, 60_000)).toBe(60_000);
    expect(windowStartFor(120_000, 60_000)).toBe(120_000);
  });
});

describe('decide', () => {
  it('permite hasta el límite y corta en la siguiente', () => {
    expect(decide(3, 0, POLICY).allowed).toBe(true);
    expect(decide(4, 0, POLICY).allowed).toBe(false);
  });

  it('reporta el remanente sin bajar de cero', () => {
    expect(decide(1, 0, POLICY).remaining).toBe(2);
    expect(decide(9, 0, POLICY).remaining).toBe(0);
  });

  it('calcula Retry-After como lo que falta para cerrar la ventana', () => {
    // 15s dentro de la ventana de 60s: quedan 45.
    expect(decide(4, 75_000, POLICY).retryAfterSeconds).toBe(45);
  });

  it('nunca devuelve Retry-After 0, que invitaría a reintentar de inmediato', () => {
    // Justo en el último milisegundo de la ventana.
    expect(decide(4, 119_999, POLICY).retryAfterSeconds).toBe(1);
  });
});

describe('contador · ventana con reloj inyectado', () => {
  it('deja pasar N requests y corta la N+1 dentro de la misma ventana', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    for (let i = 0; i < POLICY.limit; i++) {
      const decision = await enforceRateLimit({ store, identity: 'key:a', policy: POLICY, now });
      expect(decision.allowed).toBe(true);
    }

    const rejected = await enforceRateLimit({ store, identity: 'key:a', policy: POLICY, now });
    expect(rejected.allowed).toBe(false);
    expect(rejected.remaining).toBe(0);
    expect(rejected.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('vuelve a permitir al avanzar el reloj más allá de la ventana', async () => {
    const store = fakeStore();
    const first = 1_000_000;

    for (let i = 0; i <= POLICY.limit; i++) {
      await enforceRateLimit({ store, identity: 'key:a', policy: POLICY, now: first });
    }
    expect(
      (await enforceRateLimit({ store, identity: 'key:a', policy: POLICY, now: first })).allowed,
    ).toBe(false);

    const nextWindow = windowStartFor(first, POLICY.windowMs) + POLICY.windowMs;
    const after = await enforceRateLimit({
      store,
      identity: 'key:a',
      policy: POLICY,
      now: nextWindow,
    });

    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(POLICY.limit - 1);
  });

  it('no acumula del lado de acá de la ventana: sigue contando dentro del mismo minuto', async () => {
    const store = fakeStore();
    const start = windowStartFor(1_000_000, POLICY.windowMs);

    await enforceRateLimit({ store, identity: 'key:a', policy: POLICY, now: start });
    const later = await enforceRateLimit({
      store,
      identity: 'key:a',
      policy: POLICY,
      now: start + POLICY.windowMs - 1,
    });

    expect(later.remaining).toBe(POLICY.limit - 2);
  });

  it('aísla identidades: agotar una no toca a la otra', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    for (let i = 0; i <= POLICY.limit; i++) {
      await enforceRateLimit({ store, identity: 'key:a', policy: POLICY, now });
    }

    const other = await enforceRateLimit({ store, identity: 'key:b', policy: POLICY, now });
    expect(other.allowed).toBe(true);
    expect(other.remaining).toBe(POLICY.limit - 1);
  });

  it('aísla buckets: el tráfico MCP no consume la cuota de mutaciones', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    for (let i = 0; i <= MCP_POLICY.limit; i++) {
      await enforceRateLimit({ store, identity: 'key:a', policy: MCP_POLICY, now });
    }
    expect(
      (await enforceRateLimit({ store, identity: 'key:a', policy: MCP_POLICY, now })).allowed,
    ).toBe(false);

    const mutation = await enforceRateLimit({
      store,
      identity: 'key:a',
      policy: MUTATION_POLICY,
      now,
    });
    expect(mutation.allowed).toBe(true);
  });
});

describe('policyFor', () => {
  it('limita /api/mcp en cualquier método', () => {
    expect(policyFor('/api/mcp', 'GET')).toBe(MCP_POLICY);
    expect(policyFor('/api/mcp', 'POST')).toBe(MCP_POLICY);
    expect(policyFor('/api/mcp/message', 'DELETE')).toBe(MCP_POLICY);
  });

  it('limita las mutaciones de la API', () => {
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(policyFor('/api/tasks', method)).toBe(MUTATION_POLICY);
    }
  });

  it('deja pasar las lecturas sin roundtrip añadido', () => {
    expect(policyFor('/api/tasks', 'GET')).toBeNull();
    expect(policyFor('/api/tasks', 'HEAD')).toBeNull();
  });

  it('exime /api/auth (lo cubre el limitador por IP) y /api/cron (lo dispara Vercel)', () => {
    expect(policyFor('/api/auth/sign-in', 'POST')).toBeNull();
    expect(policyFor('/api/cron/daily-snapshot', 'POST')).toBeNull();
  });

  it('ignora las rutas que no son de API', () => {
    expect(policyFor('/today', 'POST')).toBeNull();
  });
});

describe('rateLimitedResponse', () => {
  it('responde 429 con Retry-After, que es lo que el cliente MCP espera', async () => {
    const res = rateLimitedResponse(decide(4, 75_000, POLICY));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('45');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    await expect(res.json()).resolves.toEqual({
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
    });
  });
});

describe('guardApiRequest', () => {
  const API_KEY = 'sk-kino-abcdefghijklmnopqrstuvwxyz';

  function req(
    path: string,
    { method = 'POST', token, cookie }: { method?: string; token?: string; cookie?: string } = {},
  ) {
    const headers = new Headers();
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (cookie) headers.set('cookie', cookie);
    return new NextRequest(`http://localhost${path}`, { method, headers });
  }

  it('no toca el store en una lectura', async () => {
    const store = fakeStore();
    const spy = vi.spyOn(store, 'hit');

    expect(await guardApiRequest(req('/api/tasks', { method: 'GET', token: API_KEY }), { store }))
      .toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('no cuenta requests sin credencial: el gate ya las cortó con 401', async () => {
    const store = fakeStore();
    const spy = vi.spyOn(store, 'hit');

    expect(await guardApiRequest(req('/api/mcp'), { store })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('corta con 429 al rebasar la cuota de MCP con la misma API key', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    for (let i = 0; i < MCP_POLICY.limit; i++) {
      expect(await guardApiRequest(req('/api/mcp', { token: API_KEY }), { store, now })).toBeNull();
    }

    const res = await guardApiRequest(req('/api/mcp', { token: API_KEY }), { store, now });
    expect(res?.status).toBe(429);
    expect(res?.headers.get('Retry-After')).toBeTruthy();
  });

  it('una segunda API key sigue pasando cuando la primera está agotada', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    for (let i = 0; i <= MCP_POLICY.limit; i++) {
      await guardApiRequest(req('/api/mcp', { token: API_KEY }), { store, now });
    }

    const other = await guardApiRequest(
      req('/api/mcp', { token: 'sk-kino-otra-llave-distinta' }),
      { store, now },
    );
    expect(other).toBeNull();
  });

  it('la sesión del navegador cuenta aparte del token del agente', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    await guardApiRequest(req('/api/tasks', { token: API_KEY }), { store, now });
    await guardApiRequest(
      req('/api/tasks', { cookie: 'better-auth.session_token=abc123' }),
      { store, now },
    );

    expect(store.rows.size).toBe(2);
  });

  it('falla abierto si el contador no responde, en vez de tumbar la API', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: RateLimitStore = {
      hit: () => Promise.reject(new Error('neon caído')),
    };

    expect(await guardApiRequest(req('/api/mcp', { token: API_KEY }), { store: broken })).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});
