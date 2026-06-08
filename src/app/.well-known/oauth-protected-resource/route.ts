import {
  protectedResourceHandler,
  metadataCorsOptionsRequestHandler,
} from "mcp-handler";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// RFC 9728 — tells MCP clients which authorization server protects /api/mcp.
export const GET = protectedResourceHandler({
  authServerUrls: [APP_URL],
  resourceUrl: `${APP_URL}/api/mcp`,
});

export const OPTIONS = metadataCorsOptionsRequestHandler();
