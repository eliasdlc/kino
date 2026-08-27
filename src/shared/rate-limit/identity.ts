import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * Identidad para el rate limit (KIN-149 / BE-12): el hash de la credencial
 * presentada, no el `userId`.
 *
 * Resolver el `userId` aquí costaría un lookup extra o verificar el JWT contra
 * el JWKS. Leer el `sub` del JWT sin verificarlo — la vía barata — sería un
 * agujero: cualquiera podría forjar un token con el `sub` de otro usuario y
 * agotarle la cuota, porque el contador se incrementa antes de que el 401
 * llegue. Hashear la credencial cruda es a prueba de eso: una credencial
 * falsificada es su propia identidad y no la de nadie más.
 *
 * El precio aceptado es que un mismo usuario con N API keys tiene N cuotas.
 * A cambio, una ráfaga del agente MCP no bloquea al humano en la UI web.
 */

/** Prefijo por tipo de identidad: hace legible la tabla y evita colisiones. */
type IdentityKind = 'key' | 'tok' | 'sess' | 'ip' | 'acct';

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function identity(kind: IdentityKind, credential: string): Promise<string> {
  return `${kind}:${await sha256Hex(credential)}`;
}

/**
 * Devuelve `null` cuando no hay credencial alguna. Esas requests no se cuentan:
 * el gate del proxy ya las corta con 401, y contarlas sólo llenaría la tabla
 * con filas de tráfico anónimo que nunca llega a ejecutar nada.
 */
export async function identityFor(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    return identity(token.startsWith('sk-kino-') ? 'key' : 'tok', token);
  }

  const sessionCookie = getSessionCookie(request);
  return sessionCookie ? identity('sess', sessionCookie) : null;
}

/**
 * La IP del cliente. `x-forwarded-for` llega como la cadena de proxies que
 * atravesó la request, y el cliente es el primero: quedarse con la cadena entera
 * daría una clave distinta por cada ruta interna que tomara, o sea ninguna cuota.
 *
 * En local no hay cabecera y todo cae en la misma clave, que es lo correcto —
 * ahí todo viene de la misma máquina.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || headers.get('x-real-ip')?.trim() || '127.0.0.1';
}

/**
 * Identidad para las rutas donde todavía no hay credencial. Se hashea como las
 * demás: mantiene el shape de la columna, evita guardar direcciones en claro y
 * hace que una IPv6 larga no desborde los 96 caracteres.
 */
export async function ipIdentityFor(request: NextRequest): Promise<string> {
  return identity('ip', clientIp(request.headers));
}

/**
 * Identidad de un intento de contraseña: la cuenta **y** la IP desde la que se
 * prueba. Con la cuenta sola, agotar la cuota de otro sería tan fácil como
 * escribir mal su contraseña cinco veces.
 *
 * El correo se normaliza en minúsculas para que `Elias@` y `elias@` no sean dos
 * cuotas distintas contra la misma cuenta.
 */
export async function signInIdentity(email: string, ip: string): Promise<string> {
  return identity('acct', `${email.trim().toLowerCase()}|${ip}`);
}
