import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createKinoFetch, KINO_MCP_VERSION, registerAllKinoTools } from "@kino-app/mcp";
import { verifyOAuthToken } from "@/shared/lib/oauth-resource";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Vercel function timeout. Kino tools are single REST calls (sub-second), but
// give headroom for cold starts. The handler runs stateless (no SSE, no Redis).
export const maxDuration = 60;

/**
 * Each request gets a fresh MCP server whose tools are wired to a loopback
 * fetcher carrying the caller's OAuth token. The REST layer re-validates that
 * token (getAuthContext) and isolates every query by user_id.
 */
const mcpHandler = (req: Request) => {
  const token = req.auth?.token ?? "";
  const kinoFetch = createKinoFetch({ baseUrl: APP_URL, token });

  return createMcpHandler(
    (server) => {
      registerAllKinoTools(server, kinoFetch);
    },
    { serverInfo: { name: "kino", version: KINO_MCP_VERSION } },
    { basePath: "/api", maxDuration: 60, disableSse: true },
  )(req);
};

const verifyToken = async (
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => {
  const claims = await verifyOAuthToken(bearerToken);
  if (!claims) return undefined;
  return {
    token: bearerToken!,
    clientId: claims.clientId,
    scopes: claims.scopes,
    extra: { userId: claims.userId },
  };
};

const handler = withMcpAuth(mcpHandler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { handler as GET, handler as POST, handler as DELETE };
