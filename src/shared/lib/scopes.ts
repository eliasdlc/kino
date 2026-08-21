/**
 * Los dos permisos que Kino distingue sobre sus propios datos.
 *
 * Los scopes de OIDC (`openid`, `profile`, `email`) dicen quién eres, no qué
 * puedes hacer. Sin estos dos, la pantalla de consentimiento pedía permisos
 * que después nadie comprobaba: todo token daba acceso a la cuenta entera.
 */
export const KINO_READ = 'kino:read';
export const KINO_WRITE = 'kino:write';

export const KINO_SCOPES = [KINO_READ, KINO_WRITE] as const;

export type KinoScope = (typeof KINO_SCOPES)[number];

function isKinoScope(scope: string): scope is KinoScope {
  return scope === KINO_READ || scope === KINO_WRITE;
}

/**
 * De dónde viene la autorización de un request.
 *
 * `owner` es la cookie de sesión o una API key personal `sk-kino-`: las dos
 * son credenciales del dueño de la cuenta y no se pueden acotar, así que
 * comprobarles un scope no significaría nada.
 */
export type AuthScopes =
  | { kind: 'owner' }
  | { kind: 'oauth'; granted: readonly string[] };

export const OWNER: AuthScopes = { kind: 'owner' };

/**
 * ¿Alcanza esta credencial para lo que exige la ruta?
 *
 * `kino:write` implica `kino:read`: quien puede escribir puede leer.
 *
 * Un token que no menciona **ninguno** de los dos es anterior a que existieran.
 * Se le da paso completo hasta que caduque, porque si no el deploy rompería la
 * conexión MCP que ya estaba viva. En cuanto un token pide uno de los dos, se
 * le exige el que toque; la regla se apaga sola conforme rotan los tokens.
 */
export function allowsScope(scopes: AuthScopes, required: KinoScope): boolean {
  if (scopes.kind === 'owner') return true;
  if (!scopes.granted.some(isKinoScope)) return true;
  if (required === KINO_READ) {
    return scopes.granted.includes(KINO_READ) || scopes.granted.includes(KINO_WRITE);
  }
  return scopes.granted.includes(KINO_WRITE);
}
