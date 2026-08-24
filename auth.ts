import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { db } from "./src/shared/db";
import * as schema from "./src/shared/db/schema";
import { KINO_READ, KINO_WRITE } from "@/shared/lib/scopes";
import { sendEmail } from "@/shared/email/send";
import { changeEmailEmail, resetPasswordEmail, verifyEmailEmail } from "@/shared/email/templates";
import { emailChangeTarget } from "@/shared/email/verification-intent";

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
      // OJO: cada `additionalField` debe existir como columna en el schema
      // Drizzle de `users`. El adaptador valida contra el schema, no contra la
      // base: un campo fantasma (xpTotal, coins, lastSyncDate — gamificación que
      // nunca se implementó) hace fallar la creación de usuarios entera, o sea
      // todo el registro. No añadir aquí nada que no esté en schema.ts.
    },
    // El correo cambia cuando la dirección nueva confirma el enlace; hasta
    // entonces la cuenta sigue con la anterior. No se avisa a la vieja: quien
    // tiene la sesión ya demostró ser el dueño, y una dirección que se perdió
    // (por eso se cambia) no recibiría el aviso de todas formas.
    changeEmail: { enabled: true },
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
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(resetPasswordEmail(user.email, url));
    },
    // La contraseña cambió porque la anterior se perdió o se filtró: cualquier
    // sesión que siguiera abierta con ella deja de valer.
    revokeSessionsOnPasswordReset: true,
  },

  // Verificar no bloquea nada: la cuenta entra y usa Kino completa. El aviso
  // persistente vive en el layout de la app y desaparece al confirmar. Google
  // y GitHub llegan con el correo ya verificado por el proveedor.
  emailVerification: {
    // El mismo hook cubre el alta y el cambio de correo; el token dice cuál es
    // y en ambos casos `user.email` ya es la dirección a la que hay que escribir.
    sendVerificationEmail: async ({ user, url, token }) => {
      const message = emailChangeTarget(token)
        ? changeEmailEmail(user.email, url)
        : verifyEmailEmail(user.email, url);
      await sendEmail(message);
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
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
      // Los de OIDC dicen quién eres; los de Kino, qué puedes hacer con tus
      // datos. Sin estos dos la pantalla de consentimiento pedía permisos que
      // después no comprobaba nadie (KIN-175).
      scopes: ["openid", "profile", "email", "offline_access", KINO_READ, KINO_WRITE],
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
