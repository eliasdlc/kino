import { importJWK, SignJWT, type JWK } from "jose";
import { MCP_CLIENT_CLAIM, MCP_TOKEN_ALGORITHM, MCP_TOKEN_AUDIENCE, MCP_TOKEN_ISSUER } from "@convex/lib/mcpToken";
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
 * Clerk exige que un scope personalizado lleve un recurso delante
 * (`documents:write`). El recurso es el que se dio al crearlos en la
 * instancia; el alcance de Kino es lo que va después de los dos puntos.
 */
export const MCP_SCOPE_RESOURCE = "documents";

/**
 * Lo que el recurso anuncia en su metadata. Los tres de Kino tienen que
 * existir como scopes personalizados en la instancia de Clerk; los de OIDC
 * son los que Clerk concede por defecto a un cliente registrado en dinámico.
 */
export const MCP_OAUTH_SCOPES = ["openid", "email", "profile", ...SCOPES.map((scope) => `${MCP_SCOPE_RESOURCE}:${scope}`)] as const;

/**
 * Lo que la pantalla de consentimiento de Clerk le promete a la persona por
 * cada alcance.
 *
 * **Vive aquí y no sólo en el Dashboard de Clerk a propósito.** El copy y el
 * catálogo tienen que decir lo mismo: prometer borrar cuando ninguna tool borra
 * asusta de gratis, y prometer un límite que el código no aplica es peor. Con
 * las frases en el repo, `auth.test.ts` puede comprobar las dos direcciones, y
 * el Dashboard pasa a ser una copia de esto en vez de una segunda fuente.
 *
 * Al cambiar una frase hay que pegarla en Clerk el mismo día que se despliega:
 * Configure > OAuth Applications > Kino > el scope > Description.
 */
export const MCP_SCOPE_CONSENT: Record<Scope, string> = {
  read: "Leer tus tareas, sistemas, cuadernos, notas y tu curva de energía.",
  propose:
    "Proponerte cambios, que aparecen en Hoy con la fila que los justifica para que los aceptes o los descartes. No escribe nada por su cuenta.",
  write:
    "Crear y editar tus tareas, sistemas, carpetas y notas, siempre con tu nombre y por qué vía en el registro, y siempre reversible desde el propio item. Puede reescribir páginas creadas por agentes y páginas tuyas sólo después de que lo autorices expresamente en la conversación. No puede borrar nada ni escribir tu check-in de energía.",
};

/** Vida del token que se firma para Convex. Cubre una petición del protocolo. */
const TOKEN_TTL = "10m";
const KEY_ID = "kino-mcp";

/**
 * El alcance efectivo de una concesión: el más fuerte de los tres que Kino
 * conoce, con o sin el recurso delante. Sin ninguno el conector sólo lee: un
 * cliente que no pidió escribir no escribe.
 */
export function scopeFor(granted: readonly string[]): Scope {
  const own = new Set(granted.map((scope) => scope.slice(scope.lastIndexOf(":") + 1)));
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
 * de Clerk, que es lo que `users.clerkId` guarda, `kino_scope` es lo que
 * `convex/lib/fn.ts` lee para autorizar cada función, y `kino_client` es el
 * cliente OAuth que actúa, tal como Clerk lo verificó.
 */
export async function mintConvexToken(input: { clerkId: string; scope: Scope; clientId?: string }): Promise<string> {
  signingKey ??= importJWK(signingJwk(), MCP_TOKEN_ALGORITHM);
  return new SignJWT({ kino_scope: input.scope, [MCP_CLIENT_CLAIM]: input.clientId })
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
