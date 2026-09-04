import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { auth } from "@clerk/nextjs/server";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { mintConvexToken, scopeFor } from "@/features/mcp/auth";
import { registerAllTools } from "@/features/mcp/tools";
import { convexCall } from "@/features/mcp/tools/define";
import { SITE_URL } from "@/shared/lib/site-url";

// La única ruta que se sale del presupuesto de 10s. El protocolo mantiene la
// petición abierta mientras el agente encadena herramientas, así que el límite
// no acota una consulta sino una conversación. Está declarado en AGENTS.md
// como la excepción viva. El handler corre stateless (sin SSE, sin Redis).
export const maxDuration = 60;

const SERVER_VERSION = "3.0.0";

/**
 * El conector MCP remoto. Cada petición monta un servidor nuevo cuyas tools
 * llaman a Convex con un token firmado para el usuario que autorizó el cliente
 * OAuth. Convex aplica la misma identidad, el mismo documento `users` y el
 * mismo alcance que al navegador: no hay una segunda puerta a los datos.
 */
const mcp = (req: Request) => {
  const token = req.auth?.extra?.convexToken;
  if (typeof token !== "string") return new Response("Unauthorized", { status: 401 });
  return createMcpHandler(
    (server) => registerAllTools(server, convexCall(token)),
    { serverInfo: { name: "kino", version: SERVER_VERSION } },
    { basePath: "/api", maxDuration, disableSse: true },
  )(req);
};

/**
 * Clerk verifica el access token OAuth (JWT u opaco) y dice quién es y qué
 * scopes concedió. Con eso se firma el token que Convex acepta; viaja en
 * `extra` porque es lo único que las tools necesitan del caller.
 */
const verify = async (_req: Request, bearer?: string): Promise<AuthInfo | undefined> => {
  const info = verifyClerkToken(await auth({ acceptsToken: "oauth_token" }), bearer);
  if (!info) return undefined;
  const clerkId = info.extra?.userId;
  if (typeof clerkId !== "string") return undefined;
  const scope = scopeFor(info.scopes);
  const convexToken = await mintConvexToken({ clerkId, scope });
  return { ...info, extra: { ...info.extra, scope, convexToken } };
};

const handler = withMcpAuth(mcp, verify, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
  resourceUrl: SITE_URL,
});

export { handler as GET, handler as POST, handler as DELETE };
