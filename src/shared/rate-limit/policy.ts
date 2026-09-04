/**
 * Política del rate limit por identidad (KIN-149 / BE-12).
 *
 * Todo lo que decide *cuánto* se permite vive aquí, en TypeScript puro y sin
 * tocar la base. El store sólo sabe incrementar un contador dentro de una
 * ventana que este módulo le calcula, así que el límite, el reseteo y el
 * `Retry-After` se prueban con un reloj inyectado y sin Postgres delante.
 *
 * La ventana es fija, alineada a múltiplos de `windowMs`. El costo conocido es
 * el borde: entre dos ventanas contiguas pueden colarse hasta 2N requests. Se
 * acepta — el objetivo es cortar abuso sostenido, no una ráfaga de un segundo.
 */

export interface RateLimitPolicy {
  /** Clase de tráfico. Cada bucket lleva su propia cuenta por identidad. */
  bucket: string;
  /** Requests permitidas por ventana. La N+1 recibe 429. */
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms en que la ventana actual termina y el contador vuelve a cero. */
  resetAt: number;
  retryAfterSeconds: number;
}

const MINUTE_MS = 60 * 1000;

/**
 * `/api/mcp` entra dos veces por cada llamada de herramienta: una por el
 * protocolo y otra por el loopback fetch que la herramienta hace contra la
 * REST con el mismo token. Por eso son buckets separados — con un contador
 * único el agente gastaría el doble de su cuota y se bloquearía a sí mismo.
 */
export const MCP_POLICY: RateLimitPolicy = {
  bucket: 'mcp',
  limit: 60,
  windowMs: MINUTE_MS,
};

export const MUTATION_POLICY: RateLimitPolicy = {
  bucket: 'mutation',
  limit: 120,
  windowMs: MINUTE_MS,
};

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Se limita lo caro: MCP y las mutaciones. Las lecturas pasan sin roundtrip
 * añadido, que es la condición bajo la que la vía Postgres sale a cuenta frente
 * a un Redis. El acceso ya no pasa por aquí: lo sirve y lo limita Clerk.
 *
 * `/api/cron/*` queda fuera: lo dispara Vercel con el `CRON_SECRET`, no un
 * usuario.
 */
export function policyFor(pathname: string, method: string): RateLimitPolicy | null {
  if (pathname.startsWith('/api/mcp')) return MCP_POLICY;
  if (!pathname.startsWith('/api/')) return null;
  if (pathname.startsWith('/api/cron/')) return null;
  return MUTATING_METHODS.has(method.toUpperCase()) ? MUTATION_POLICY : null;
}

/** Inicio de la ventana que contiene `now`, alineado a múltiplos de `windowMs`. */
export function windowStartFor(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}

/**
 * Traduce el contador ya incrementado a una decisión. `hits` es el valor
 * *después* de contar esta request, así que la primera llega con 1 y la que
 * rebasa el límite llega con `limit + 1`.
 */
export function decide(hits: number, now: number, policy: RateLimitPolicy): RateLimitDecision {
  const resetAt = windowStartFor(now, policy.windowMs) + policy.windowMs;
  return {
    allowed: hits <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - hits),
    resetAt,
    // Nunca 0: un `Retry-After: 0` invita a reintentar de inmediato y el
    // cliente vuelve a chocar contra la misma ventana.
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}
