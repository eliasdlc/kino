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

/**
 * Una política que el proxy aplica por path, y de dónde saca la clave con la
 * que cuenta.
 *
 * `credential` es el hash de la credencial presentada. `ip` es para el acceso,
 * donde todavía no hay ninguna: quien prueba contraseñas no tiene sesión ni
 * token que hashear, y la IP es lo único que queda.
 */
export interface ProxyRateLimitPolicy extends RateLimitPolicy {
  keyBy: 'credential' | 'ip';
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
export const MCP_POLICY: ProxyRateLimitPolicy = {
  bucket: 'mcp',
  limit: 60,
  windowMs: MINUTE_MS,
  keyBy: 'credential',
};

export const MUTATION_POLICY: ProxyRateLimitPolicy = {
  bucket: 'mutation',
  limit: 120,
  windowMs: MINUTE_MS,
  keyBy: 'credential',
};

/**
 * Techo de abuso sobre `/api/auth/*` entero. Generoso a propósito: por aquí pasa
 * también el baile de OAuth del conector MCP, y varias personas detrás de un
 * mismo NAT comparten IP. Lo que corta de verdad la fuerza bruta es
 * `AUTH_CREDENTIAL_POLICY`.
 */
export const AUTH_POLICY: ProxyRateLimitPolicy = {
  bucket: 'auth',
  limit: 60,
  windowMs: MINUTE_MS,
  keyBy: 'ip',
};

/**
 * Los endpoints donde se presenta una credencial o se dispara un correo. Es la
 * superficie que se prueba a ciegas, y la que aguanta el límite estrecho.
 */
export const AUTH_CREDENTIAL_POLICY: ProxyRateLimitPolicy = {
  bucket: 'auth-credential',
  limit: 10,
  windowMs: MINUTE_MS,
  keyBy: 'ip',
};

/**
 * Intentos de contraseña contra una cuenta concreta, contados por `(cuenta, IP)`
 * y no por cuenta a secas. Esa distinción es el ticket entero: con la clave sólo
 * por cuenta, cualquiera deja fuera al dueño legítimo fallando su contraseña
 * veinte veces, y la defensa se convierte en el ataque.
 *
 * La ventana es larga porque adivinar una contraseña es un juego de volumen: diez
 * por minuto durante una hora son seiscientos intentos, cinco cada cuarto de hora
 * son veinte. El acierto borra el contador (`clearSignInAttempts`), así que
 * equivocarse cuatro veces y acertar a la quinta no deja rastro.
 */
export const AUTH_ACCOUNT_POLICY: RateLimitPolicy = {
  bucket: 'auth-account',
  limit: 5,
  windowMs: 15 * MINUTE_MS,
};

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Donde se presenta una credencial o se dispara un correo a una dirección que el
 * visitante elige. Better Auth expone `request-password-reset` y mantiene
 * `forget-password` como alias, así que están los dos.
 */
const CREDENTIAL_PATHS = new Set([
  '/api/auth/sign-in/email',
  '/api/auth/sign-up/email',
  '/api/auth/forget-password',
  '/api/auth/request-password-reset',
  '/api/auth/reset-password',
  '/api/auth/send-verification-email',
]);

/**
 * Se limita lo caro y lo que se puede probar a ciegas: MCP, las mutaciones y el
 * acceso. Las lecturas pasan sin roundtrip añadido, que es la condición bajo la
 * que la vía Postgres sale a cuenta frente a un Redis.
 *
 * `/api/cron/*` queda fuera: lo dispara Vercel con el `CRON_SECRET`, no un
 * usuario.
 */
export function policyFor(pathname: string, method: string): ProxyRateLimitPolicy | null {
  if (pathname.startsWith('/api/mcp')) return MCP_POLICY;
  if (!pathname.startsWith('/api/')) return null;
  if (pathname.startsWith('/api/cron/')) return null;
  if (pathname.startsWith('/api/auth/')) {
    return CREDENTIAL_PATHS.has(pathname) ? AUTH_CREDENTIAL_POLICY : AUTH_POLICY;
  }
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
