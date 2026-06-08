import { createAuthClient } from "better-auth/client";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { auth } from "@/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** The MCP endpoint is the protected resource and the OAuth token audience. */
export const MCP_RESOURCE_URL = `${APP_URL}/api/mcp`;

/** Issuer/JWKS are pinned to the Better Auth baseURL (see src/auth.ts). */
const ISSUER = APP_URL;
const JWKS_URL = `${APP_URL}/api/auth/jwks`;

/**
 * Server-side resource client bound to the auth instance. Verifies OAuth 2.1
 * access tokens locally against the JWKS — no extra network round trip.
 */
const resourceClient = createAuthClient({
  plugins: [oauthProviderResourceClient(auth)],
});

export type OAuthTokenClaims = {
  userId: string;
  clientId: string;
  scopes: string[];
};

/**
 * Validates a Bearer access token issued by Kino's OAuth provider.
 * Returns the resolved claims, or null if the token is missing/invalid/expired.
 */
export async function verifyOAuthToken(
  token: string | undefined,
): Promise<OAuthTokenClaims | null> {
  if (!token) return null;
  try {
    const payload = await resourceClient.verifyAccessToken(token, {
      verifyOptions: { audience: MCP_RESOURCE_URL, issuer: ISSUER },
      jwksUrl: JWKS_URL,
    });
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) return null;

    const clientId =
      typeof payload.azp === "string"
        ? payload.azp
        : typeof payload.client_id === "string"
          ? payload.client_id
          : "";
    const scope = typeof payload.scope === "string" ? payload.scope : "";
    const scopes = scope ? scope.split(" ") : [];

    return { userId, clientId, scopes };
  } catch {
    return null;
  }
}
