import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  AUTH_ACCOUNT_POLICY,
  AUTH_CREDENTIAL_POLICY,
  AUTH_POLICY,
  clientIp,
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
import {
  clearSignInAttempts,
  didSignIn,
  guardSignInAttempt,
} from '@/shared/rate-limit/sign-in-attempts';

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
    async reset(identity, bucket) {
      rows.delete(`${identity}|${bucket}`);
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

  it('aprieta los endpoints donde se prueba una credencial', () => {
    expect(policyFor('/api/auth/sign-in/email', 'POST')).toBe(AUTH_CREDENTIAL_POLICY);
    expect(policyFor('/api/auth/sign-up/email', 'POST')).toBe(AUTH_CREDENTIAL_POLICY);
    expect(policyFor('/api/auth/reset-password', 'POST')).toBe(AUTH_CREDENTIAL_POLICY);
  });

  it('deja el resto de /api/auth con el techo ancho, que también pasa el baile de OAuth', () => {
    expect(policyFor('/api/auth/get-session', 'GET')).toBe(AUTH_POLICY);
    expect(policyFor('/api/auth/callback/google', 'GET')).toBe(AUTH_POLICY);
    expect(AUTH_POLICY.limit).toBeGreaterThan(AUTH_CREDENTIAL_POLICY.limit);
  });

  it('exime /api/cron, que lo dispara Vercel con el CRON_SECRET', () => {
    expect(policyFor('/api/cron/daily-snapshot', 'POST')).toBeNull();
  });

  it('ignora las rutas que no son de API', () => {
    expect(policyFor('/today', 'POST')).toBeNull();
  });
});

describe('policyFor · la clasificación de /api/auth/*', () => {
  it('lo que presenta una credencial adivinable va al bucket estrecho', () => {
    for (const path of [
      '/api/auth/sign-in/email',
      '/api/auth/sign-up/email',
      '/api/auth/request-password-reset',
      '/api/auth/forget-password',
      '/api/auth/reset-password',
      '/api/auth/reset-password/un-token',
      '/api/auth/change-password',
      '/api/auth/verify-password',
    ]) {
      expect(policyFor(path, 'POST')).toBe(AUTH_CREDENTIAL_POLICY);
    }
  });

  it('lo que manda un correo también, porque se puede abusar del envío', () => {
    expect(policyFor('/api/auth/send-verification-email', 'POST')).toBe(AUTH_CREDENTIAL_POLICY);
    expect(policyFor('/api/auth/change-email', 'POST')).toBe(AUTH_CREDENTIAL_POLICY);
  });

  it('el handshake del MCP no compite con el login', () => {
    for (const path of [
      '/api/auth/oauth2/register',
      '/api/auth/oauth2/authorize',
      '/api/auth/oauth2/token',
      '/api/auth/jwks',
      '/api/auth/token',
    ]) {
      expect(policyFor(path, 'POST')).toBe(AUTH_POLICY);
    }
  });

  it('el login social y su retorno tampoco: no presentan credencial', () => {
    expect(policyFor('/api/auth/sign-in/social', 'POST')).toBe(AUTH_POLICY);
    expect(policyFor('/api/auth/callback/google', 'GET')).toBe(AUTH_POLICY);
  });

  it('leer la sesión o salir no gasta la cuota de entrar', () => {
    expect(policyFor('/api/auth/get-session', 'GET')).toBe(AUTH_POLICY);
    expect(policyFor('/api/auth/sign-out', 'POST')).toBe(AUTH_POLICY);
  });

  it('el prefijo no se desborda fuera de /api/auth', () => {
    expect(policyFor('/api/authorization', 'GET')).toBeNull();
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
    {
      method = 'POST',
      token,
      cookie,
      ip,
    }: { method?: string; token?: string; cookie?: string; ip?: string } = {},
  ) {
    const headers = new Headers();
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (cookie) headers.set('cookie', cookie);
    if (ip) headers.set('x-forwarded-for', ip);
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
      reset: () => Promise.reject(new Error('neon caído')),
    };

    expect(await guardApiRequest(req('/api/mcp', { token: API_KEY }), { store: broken })).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('clientIp', () => {
  it('se queda con el cliente, no con la cadena de proxies', () => {
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 10.0.0.2' });
    expect(clientIp(headers)).toBe('203.0.113.9');
  });

  it('cae a x-real-ip y, sin nada, a loopback', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(new Headers())).toBe('127.0.0.1');
  });
});

/**
 * El límite por IP del acceso (KIN-161). Lo que se afirma aquí es lo que el
 * `Map` en memoria no podía dar: que el contador es el mismo para todas las
 * instancias. El `fakeStore` representa ese Postgres compartido — dos requests
 * que en producción atendería otro arranque en frío ven el mismo contador.
 */
describe('acceso · límite por IP', () => {
  function signIn(ip: string) {
    return new NextRequest('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      headers: new Headers({ 'x-forwarded-for': ip }),
    });
  }

  it('cuenta el acceso aunque no haya credencial: es justo cuando no la hay', async () => {
    const store = fakeStore();
    const spy = vi.spyOn(store, 'hit');

    await guardApiRequest(signIn('203.0.113.9'), { store, now: 1_000_000 });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('corta con 429 al rebasar la cuota desde la misma IP', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    for (let i = 0; i < AUTH_CREDENTIAL_POLICY.limit; i++) {
      expect(await guardApiRequest(signIn('203.0.113.9'), { store, now })).toBeNull();
    }

    const res = await guardApiRequest(signIn('203.0.113.9'), { store, now });
    expect(res?.status).toBe(429);
  });

  it('el bloqueo sobrevive al cambio de instancia, que es el ticket entero', async () => {
    // Un store, dos "instancias": nada de estado en el módulo. Con el `Map` de
    // antes, la segunda arrancaba con la cuota entera.
    const shared = fakeStore();
    const now = 1_000_000;

    for (let i = 0; i <= AUTH_CREDENTIAL_POLICY.limit; i++) {
      await guardApiRequest(signIn('203.0.113.9'), { store: shared, now });
    }

    const fromAnotherInstance = await guardApiRequest(signIn('203.0.113.9'), {
      store: shared,
      now,
    });
    expect(fromAnotherInstance?.status).toBe(429);
  });

  it('otra IP no hereda el bloqueo', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    for (let i = 0; i <= AUTH_CREDENTIAL_POLICY.limit; i++) {
      await guardApiRequest(signIn('203.0.113.9'), { store, now });
    }

    expect(await guardApiRequest(signIn('198.51.100.4'), { store, now })).toBeNull();
  });

  it('la sesión del navegador no comparte cuota con el acceso', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    const mutation = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      headers: new Headers({
        'x-forwarded-for': '203.0.113.9',
        cookie: 'better-auth.session_token=abc123',
      }),
    });

    await guardApiRequest(signIn('203.0.113.9'), { store, now });
    await guardApiRequest(mutation, { store, now });

    expect(store.rows.size).toBe(2);
  });
});

/**
 * El límite por cuenta. La pregunta que responde este bloque no es "¿corta?",
 * es "¿puede alguien usarlo para dejar fuera al dueño?". La respuesta tiene que
 * ser no, y por eso la clave lleva la IP dentro.
 */
describe('acceso · límite por cuenta', () => {
  const ATTACKER = '203.0.113.9';
  const OWNER = '198.51.100.4';
  const EMAIL = 'elias@usekino.dev';

  async function exhaust(store: RateLimitStore, email: string, ip: string, now: number) {
    for (let i = 0; i < AUTH_ACCOUNT_POLICY.limit; i++) {
      expect(await guardSignInAttempt(email, ip, { store, now })).toBeNull();
    }
  }

  it('corta tras agotar los intentos contra esa cuenta desde esa IP', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    await exhaust(store, EMAIL, ATTACKER, now);

    const blocked = await guardSignInAttempt(EMAIL, ATTACKER, { store, now });
    expect(blocked?.allowed).toBe(false);
    expect(blocked?.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('el dueño entra desde su IP aunque otra esté bloqueada contra su cuenta', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    await exhaust(store, EMAIL, ATTACKER, now);
    expect((await guardSignInAttempt(EMAIL, ATTACKER, { store, now }))?.allowed).toBe(false);

    expect(await guardSignInAttempt(EMAIL, OWNER, { store, now })).toBeNull();
  });

  it('no mezcla cuentas: agotar una no toca a la de al lado', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    await exhaust(store, EMAIL, ATTACKER, now);
    expect(await guardSignInAttempt('otra@usekino.dev', ATTACKER, { store, now })).toBeNull();
  });

  it('el correo no distingue mayúsculas: Elias@ y elias@ son la misma cuota', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    await exhaust(store, EMAIL, ATTACKER, now);

    const blocked = await guardSignInAttempt('  ELIAS@usekino.dev ', ATTACKER, { store, now });
    expect(blocked?.allowed).toBe(false);
  });

  it('acertar borra los fallos previos: equivocarse cuatro veces no deja deuda', async () => {
    const store = fakeStore();
    const now = 1_000_000;

    for (let i = 0; i < AUTH_ACCOUNT_POLICY.limit - 1; i++) {
      await guardSignInAttempt(EMAIL, OWNER, { store, now });
    }
    await clearSignInAttempts(EMAIL, OWNER, { store });

    // La cuota vuelve entera, no queda en el último intento.
    await exhaust(store, EMAIL, OWNER, now);
    expect((await guardSignInAttempt(EMAIL, OWNER, { store, now }))?.allowed).toBe(false);
  });

  it('deja entrar si el contador no responde, en vez de cerrar la app', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: RateLimitStore = {
      hit: () => Promise.reject(new Error('neon caído')),
      reset: () => Promise.reject(new Error('neon caído')),
    };

    expect(await guardSignInAttempt(EMAIL, OWNER, { store: broken })).toBeNull();
    // Y limpiar tampoco puede lanzar: el acceso ya ocurrió.
    await expect(clearSignInAttempts(EMAIL, OWNER, { store: broken })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

/**
 * Cuándo se puede borrar el contador. El hook `after` de Better Auth corre
 * también cuando la contraseña era mala —el error se captura y se le pasa al
 * hook antes de decidir que fue un error—, así que limpiar sin mirar deja el
 * contador en cero tras cada fallo y el límite deja de existir.
 */
describe('didSignIn', () => {
  it('reconoce el acceso conseguido, que es lo único que limpia', () => {
    expect(didSignIn({ redirect: false, token: 'abc', user: { id: 'u-1' } })).toBe(true);
  });

  it('no toma por acceso el error que devuelve una contraseña mala', () => {
    const apiError = Object.assign(new Error('Invalid email or password'), {
      status: 'UNAUTHORIZED',
      body: { code: 'INVALID_EMAIL_OR_PASSWORD' },
    });
    expect(didSignIn(apiError)).toBe(false);
  });

  it('exige usuario: un shape que no reconoce no cuenta como acierto', () => {
    expect(didSignIn({ redirect: false, token: 'abc' })).toBe(false);
    expect(didSignIn({ user: null })).toBe(false);
    expect(didSignIn(undefined)).toBe(false);
    expect(didSignIn(null)).toBe(false);
    expect(didSignIn('ok')).toBe(false);
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});
