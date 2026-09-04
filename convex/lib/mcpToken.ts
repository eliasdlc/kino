// El JWT que el conector MCP acuña para hablar con Convex en nombre de quien
// autorizó el cliente OAuth. Clerk verifica el access token OAuth en la ruta
// `/api/mcp`; Convex no puede hacerlo directamente porque el `aud` de ese
// token cambia por cliente registrado. La ruta firma entonces uno propio, de
// vida corta, con el alcance en `kino_scope`, y Convex lo valida con el
// provider `customJwt` de `auth.config.ts`.
//
// Los dos lados (Next firma, Convex verifica) comparten estas constantes.

/** El `iss` del token. Es un identificador, no una URL que se consulte. */
export const MCP_TOKEN_ISSUER = 'https://usekino.dev/mcp';

/** El `aud` del token, el mismo que la plantilla `convex` de Clerk. */
export const MCP_TOKEN_AUDIENCE = 'convex';

/** Algoritmo de firma. La clave pública viaja a Convex como JWKS en `KINO_MCP_JWKS`. */
export const MCP_TOKEN_ALGORITHM = 'ES256' as const;
