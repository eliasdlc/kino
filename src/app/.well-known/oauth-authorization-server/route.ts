import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { metadataCorsOptionsRequestHandler } from "mcp-handler";
import { auth } from "@/auth";

// RFC 8414 — re-exposes Better Auth's OAuth metadata at the well-known root
// (Better Auth otherwise serves it under /api/auth). CORS allows browser-based
// MCP clients (Claude) to discover it.
export const GET = oauthProviderAuthServerMetadata(auth, {
  headers: { "Access-Control-Allow-Origin": "*" },
});

export const OPTIONS = metadataCorsOptionsRequestHandler();
