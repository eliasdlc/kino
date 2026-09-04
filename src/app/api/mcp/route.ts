import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createKinoFetch, registerAllKinoTools, MCP_SERVER_VERSION } from "@kino-app/mcp";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// La única ruta que se sale del presupuesto de 10s. El protocolo mantiene la
// petición abierta mientras el agente encadena herramientas, así que el límite
// no acota una consulta sino una conversación. Está declarado en AGENTS.md
// como la excepción viva. El handler corre stateless (sin SSE, sin Redis).
export const maxDuration = 60;

/**
 * Each request gets a fresh MCP server whose tools are wired to a loopback
 * fetcher carrying the caller's OAuth token. The REST layer re-validates that
 * token (getAuthContext) and isolates every query by user_id.
 *
 * El loopback tiene un coste que conviene tener escrito: cada llamada de
 * herramienta son **dos** invocaciones de función y dos viajes por internet,
 * una por el protocolo y otra por la API pública. Por eso `policy.ts` mantiene
 * buckets separados de rate limit (`mcp` y `mutation`): con un contador único
 * el agente se bloquearía a sí mismo.
 *
 * Se paga a cambio de que las herramientas pasen por la misma validación Zod,
 * la misma autorización y el mismo `getAuthContext` que el navegador. No hay
 * una segunda puerta a los datos con reglas propias, y `packages/mcp` sigue
 * sirviendo como cliente contra cualquier despliegue, que es lo que hace
 * funcionar el CLI y el MCP por stdio.
 */
const mcpHandler = (req: Request) => {
  const token = req.auth?.token ?? "";
  const kinoFetch = createKinoFetch({ baseUrl: APP_URL, token });

  return createMcpHandler(
    (server) => {
      registerAllKinoTools(server, kinoFetch);
    },
    { serverInfo: { name: "kino", version: MCP_SERVER_VERSION } },
    { basePath: "/api", maxDuration: 60, disableSse: true },
  )(req);
};

// Sin emisor de tokens hasta que el MCP remoto se escriba sobre el OAuth de
// Clerk: mientras tanto todo Bearer se rechaza y el conector responde 401.
const verifyToken = async (): Promise<AuthInfo | undefined> => undefined;

const handler = withMcpAuth(mcpHandler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { handler as GET, handler as POST, handler as DELETE };
