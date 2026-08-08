import { NextResponse, type NextRequest } from 'next/server';
import { identityFor } from './identity';
import { decide, policyFor, windowStartFor, type RateLimitDecision, type RateLimitPolicy } from './policy';
import type { RateLimitStore } from './store';

export * from './policy';
export type { RateLimitStore } from './store';

/**
 * Cuenta la request y devuelve la decisión. El reloj y el store entran por
 * parámetro: la política es determinista y se prueba sin Postgres delante.
 */
export async function enforceRateLimit(args: {
  store: RateLimitStore;
  identity: string;
  policy: RateLimitPolicy;
  now: number;
}): Promise<RateLimitDecision> {
  const { store, identity, policy, now } = args;
  const windowStart = new Date(windowStartFor(now, policy.windowMs));
  const hits = await store.hit(identity, policy.bucket, windowStart);
  return decide(hits, now, policy);
}

/**
 * `Retry-After` es lo que `packages/mcp/src/client.ts` necesita para que el
 * modelo reciba "wait a moment and try again" en vez de un error crudo. El
 * `code` mantiene el shape que el proxy ya devolvía en `/api/auth/*`.
 */
export function rateLimitedResponse(decision: RateLimitDecision): NextResponse {
  return NextResponse.json(
    { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(decision.retryAfterSeconds),
        'X-RateLimit-Limit': String(decision.limit),
        'X-RateLimit-Remaining': String(decision.remaining),
        'X-RateLimit-Reset': String(Math.ceil(decision.resetAt / 1000)),
      },
    },
  );
}

/**
 * Punto de entrada del proxy. Devuelve la respuesta 429 cuando toca cortar, o
 * `null` para dejar pasar.
 *
 * **Falla abierto a propósito.** Si Neon no responde, la request pasa: un
 * limitador de costo caído no debe tumbar la API entera. El error se loguea
 * para que la caída se vea en vez de degradarse en silencio.
 */
export async function guardApiRequest(
  request: NextRequest,
  overrides: { store?: RateLimitStore; now?: number } = {},
): Promise<NextResponse | null> {
  const policy = policyFor(request.nextUrl.pathname, request.method);
  if (!policy) return null;

  const identity = await identityFor(request);
  if (!identity) return null;

  try {
    const store = overrides.store ?? (await import('./store')).postgresRateLimitStore;
    const decision = await enforceRateLimit({
      store,
      identity,
      policy,
      now: overrides.now ?? Date.now(),
    });
    return decision.allowed ? null : rateLimitedResponse(decision);
  } catch (error) {
    console.error('[rate-limit] contador no disponible, se deja pasar:', error);
    return null;
  }
}
