import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { db } from "./src/shared/db";
import * as schema from "./src/shared/db/schema";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  // Pin the issuer so OAuth/OIDC token `iss` and JWKS URLs are deterministic
  // (request-derived origin is unreliable behind the Vercel proxy).
  baseURL: APP_URL,
  trustedOrigins: [APP_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      // Map the oauth-provider plugin models to our (plural) table exports.
      oauthClient: schema.oauthClients,
      oauthAccessToken: schema.oauthAccessTokens,
      oauthConsent: schema.oauthConsents,
      oauthRefreshToken: schema.oauthRefreshTokens,
    },
  }),
  // Better Auth's "user" model → our "users" table
  user: {
    modelName: "users",
    additionalFields: {
      onboardingCompleted: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      xpTotal: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
      },
      coins: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
      },
      timezone: {
        type: "string",
        required: false,
        defaultValue: "America/Santo_Domingo",
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "active",
        input: false,
      },
      provider: {
        type: "string",
        required: false,
        defaultValue: "local",
        input: false,
      },
      providerId: {
        type: "string",
        required: false,
        input: false,
      },
      lastSyncDate: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },

  session: {
    modelName: "sessions",
  },

  // Better Auth manages OAuth accounts separately from the user table.
  // This is the "accounts" table in our schema.
  account: {
    modelName: "accounts",
  },

  verification: {
    modelName: "verifications",
  },

  emailAndPassword: {
    enabled: true,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },

  advanced: {
    database: {
      generateId: false,
    },
  },

  plugins: [
    // Pin the token issuer to the app origin (not the /api/auth base path) so
    // OAuth discovery, the token `iss`, and our verification all agree on a
    // single root issuer. See src/app/.well-known/* and oauth-resource.ts.
    jwt({ jwt: { issuer: APP_URL } }),
    oauthProvider({
      loginPage: "/login",
      consentPage: "/consent",
      // Claude (and other browser-based MCP clients) self-register as public
      // clients via Dynamic Client Registration before the user is known.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      scopes: ["openid", "profile", "email", "offline_access"],
      // The MCP endpoint is the protected resource / token audience.
      validAudiences: [`${APP_URL}/api/mcp`],
      // The root .well-known routes satisfy these discovery docs.
      silenceWarnings: {
        oauthAuthServerConfig: true,
        openidConfig: true,
      },
    }),
  ],
});
