import { enforceRateLimit } from './index';
import { signInIdentity } from './identity';
import { AUTH_ACCOUNT_POLICY, type RateLimitDecision } from './policy';
import type { RateLimitStore } from './store';

/**
 * El límite por cuenta del acceso, el que el proxy no puede poner.
 *
 * El proxy sólo ve la IP: cuenta todo lo que entra por `/api/auth/*` y corta a
 * quien machaca desde un sitio. Lo que no ve es *contra qué cuenta* se está
 * probando, porque eso viaja en el cuerpo de la request. Por eso este contador
 * vive en un hook de Better Auth, donde el correo ya está parseado y además se
 * sabe si la contraseña era la buena.
 *
 * Los dos límites son distintos a propósito:
 *
 * - Por IP, en el proxy: frena a quien prueba muchas cuentas desde un sitio.
 * - Por `(cuenta, IP)`, aquí: frena a quien prueba muchas contraseñas contra una
 *   cuenta, sin que eso sirva para dejar fuera a su dueño. Si la clave fuera sólo
 *   la cuenta, agotarla desde fuera bloquearía a quien sí sabe la contraseña, y
 *   la defensa se volvería el ataque.
 *
 * Acertar borra el contador, así que equivocarse cuatro veces y entrar a la
 * quinta no deja deuda.
 *
 * Falla abierto, como el resto del limitador: si la base no responde, se entra.
 * Un contador caído no debe cerrar la puerta de la app.
 */

/**
 * Si la respuesta que devolvió el endpoint es un acceso conseguido.
 *
 * Hace falta porque el hook `after` de Better Auth corre **también cuando el
 * acceso falla**: el error se captura y se le pasa al hook en
 * `ctx.context.returned`, y sólo después se comprueba si era un error. Limpiar
 * sin mirar dejaba el contador en cero tras cada contraseña equivocada, o sea
 * ningún límite.
 *
 * La condición es positiva a propósito. Preguntar "¿no es un error?" haría que
 * un shape inesperado se leyera como éxito y volviera a abrir el agujero;
 * preguntar "¿trae usuario?" hace que lo peor que puede pasar es dejar de
 * limpiar, que sólo cuesta paciencia a quien tecleó mal.
 */
export function didSignIn(returned: unknown): boolean {
  if (typeof returned !== 'object' || returned === null) return false;
  if (returned instanceof Error) return false;
  const user = (returned as { user?: unknown }).user;
  return typeof user === 'object' && user !== null;
}

/** Sólo para los tests: el store y el reloj entran por parámetro. */
export interface SignInAttemptOverrides {
  store?: RateLimitStore;
  now?: number;
}

async function resolveStore(overrides: SignInAttemptOverrides): Promise<RateLimitStore> {
  return overrides.store ?? (await import('./store')).postgresRateLimitStore;
}

/**
 * Cuenta el intento y dice si se puede seguir. `null` es "adelante", incluida la
 * caída del contador; una decisión significa que hay que responder 429 con su
 * `Retry-After`.
 */
export async function guardSignInAttempt(
  email: string,
  ip: string,
  overrides: SignInAttemptOverrides = {},
): Promise<RateLimitDecision | null> {
  try {
    const decision = await enforceRateLimit({
      store: await resolveStore(overrides),
      identity: await signInIdentity(email, ip),
      policy: AUTH_ACCOUNT_POLICY,
      now: overrides.now ?? Date.now(),
    });
    return decision.allowed ? null : decision;
  } catch (error) {
    console.error('[rate-limit] intentos de acceso no contados, se deja pasar:', error);
    return null;
  }
}

/** Se llama al entrar de verdad. Nunca lanza: el acceso ya ocurrió. */
export async function clearSignInAttempts(
  email: string,
  ip: string,
  overrides: SignInAttemptOverrides = {},
): Promise<void> {
  try {
    const store = await resolveStore(overrides);
    await store.reset(await signInIdentity(email, ip), AUTH_ACCOUNT_POLICY.bucket);
  } catch (error) {
    console.error('[rate-limit] no se pudo limpiar el contador de accesos:', error);
  }
}
