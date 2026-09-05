import type { NextRequest } from 'next/server';

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
type IdentityKind = 'key' | 'tok' | 'sess';

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

  // La cookie de sesión de Clerk: un JWT corto que se renueva solo. Hashearlo
  // entero es lo que hace que una sesión sea su propia identidad.
  const sessionCookie = request.cookies.get('__session')?.value;
  return sessionCookie ? identity('sess', sessionCookie) : null;
}
