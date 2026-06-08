import { oauthProviderOpenIdConfigMetadata } from "@better-auth/oauth-provider";
import { metadataCorsOptionsRequestHandler } from "mcp-handler";
import { auth } from "@/auth";

// OpenID Connect discovery document, re-exposed at the well-known root with CORS.
export const GET = oauthProviderOpenIdConfigMetadata(auth, {
  headers: { "Access-Control-Allow-Origin": "*" },
});

export const OPTIONS = metadataCorsOptionsRequestHandler();
