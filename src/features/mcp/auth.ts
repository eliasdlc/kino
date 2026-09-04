import { importJWK, SignJWT, type JWK } from "jose";
import { MCP_TOKEN_ALGORITHM, MCP_TOKEN_AUDIENCE, MCP_TOKEN_ISSUER } from "@convex/lib/mcpToken";
import { SCOPES, type Scope } from "@convex/lib/scopes";
import { SITE_URL } from "@/shared/lib/site-url";

/**
 * Quién puede entrar por `/api/mcp` y con qué alcance.
 *
 * Clerk es el servidor OAuth: el cliente (Claude Code, Claude Desktop, el
 * conector de claude.ai) se registra solo, el usuario consiente en la pantalla
 * de Clerk y llega aquí con un access token. La ruta lo verifica con Clerk y
 * traduce los scopes concedidos al alcance que Convex entiende.
 */

/** El recurso que protege el OAuth. Es la URL que el cliente configura. */
export const MCP_RESOURCE_URL = `${SITE_URL}/api/mcp`;

/**
 * Lo que el recurso anuncia en su metadata. Los tres de Kino tienen que
 * existir como scopes personalizados en la instancia de Clerk; los de OIDC
 * son los que Clerk concede por defecto a un cliente registrado en dinámico.
 */
export const MCP_OAUTH_SCOPES = ["openid", "email", "profile", ...SCOPES] as const;

/** Vida del token que se firma para Convex. Cubre una petición del protocolo. */
const TOKEN_TTL = "10m";
const KEY_ID = "kino-mcp";

/**
 * El alcance efectivo de una concesión: el más fuerte de los tres que Kino
 * conoce, aceptando también la forma con prefijo (`kino:write`). Sin ninguno
 * el conector sólo lee: un cliente que no pidió escribir no escribe.
 */
export function scopeFor(granted: readonly string[]): Scope {
  const own = new Set(granted.map((scope) => scope.replace(/^kino:/, "")));
  if (own.has("write")) return "write";
  if (own.has("propose")) return "propose";
  return "read";
}

function signingJwk(): JWK {
  const raw = process.env.KINO_MCP_SIGNING_JWK;
  if (!raw) throw new Error("Falta KINO_MCP_SIGNING_JWK: el conector MCP no puede firmar tokens para Convex.");
  return JSON.parse(raw) as JWK;
}

let signingKey: Promise<CryptoKey | Uint8Array> | undefined;

/**
 * El token que Convex acepta por el provider `customJwt`: el `sub` es el id
 * de Clerk, que es lo que `users.clerkId` guarda, y `kino_scope` es lo que
 * `convex/lib/fn.ts` lee para autorizar cada función.
 */
export async function mintConvexToken(input: { clerkId: string; scope: Scope }): Promise<string> {
  signingKey ??= importJWK(signingJwk(), MCP_TOKEN_ALGORITHM);
  return new SignJWT({ kino_scope: input.scope })
    .setProtectedHeader({ alg: MCP_TOKEN_ALGORITHM, kid: KEY_ID })
    .setIssuer(MCP_TOKEN_ISSUER)
    .setAudience(MCP_TOKEN_AUDIENCE)
    .setSubject(input.clerkId)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(await signingKey);
}

/** La mitad pública de la clave, tal como Convex la espera en `KINO_MCP_JWKS`. */
export function publicJwks(privateJwk: JWK): { keys: JWK[] } {
  const publicJwk: JWK = { ...privateJwk, kid: KEY_ID, alg: MCP_TOKEN_ALGORITHM, use: "sig" };
  delete publicJwk.d;
  return { keys: [publicJwk] };
}
