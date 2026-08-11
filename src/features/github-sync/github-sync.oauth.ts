import { randomBytes } from "node:crypto";

/**
 * Flujo OAuth de GitHub para la **conexión de sincronización** (KIN-135).
 *
 * Por qué no se reutiliza el login de GitHub de Better Auth, que ya existe:
 *
 * 1. Un OAuth App de GitHub admite **una sola** URL de callback, y la del login
 *    (`/api/auth/callback/github`) ya la ocupa. GitHub exige que el `redirect_uri`
 *    cuelgue de esa ruta, y `/api/integrations/github/callback` no cuelga.
 * 2. Los scopes son distintos: el login sólo necesita identidad, y leer issues
 *    de repositorios privados necesita `repo`.
 * 3. Quien entró con Google no tendría ningún token de GitHub que reutilizar.
 *
 * Por eso son credenciales propias, en `GITHUB_SYNC_CLIENT_ID` /
 * `GITHUB_SYNC_CLIENT_SECRET`, de un OAuth App aparte.
 */

const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";

/**
 * `repo` da lectura y escritura sobre repositorios privados; GitHub no ofrece un
 * scope de sólo-lectura para ellos. La sincronización es de sólo lectura por
 * diseño (nunca se llama a un endpoint de escritura), pero el permiso concedido
 * es más amplio de lo que se usa y conviene que se sepa.
 */
export const GITHUB_SCOPES = "repo read:user";

/** Cookie con el `state` de CSRF. Efímera: sólo vive durante el redirect. */
export const OAUTH_STATE_COOKIE = "kino_gh_state";
/** Sistema al que volver tras conectar, para no perder el contexto. */
export const OAUTH_RETURN_COOKIE = "kino_gh_return";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GithubOAuthNotConfigured extends Error {
  constructor() {
    super(
      "Falta GITHUB_SYNC_CLIENT_ID / GITHUB_SYNC_CLIENT_SECRET. Registra un OAuth App en GitHub con callback <APP_URL>/api/integrations/github/callback.",
    );
    this.name = "GithubOAuthNotConfigured";
  }
}

export function readOAuthConfig(): OAuthConfig {
  const clientId = process.env.GITHUB_SYNC_CLIENT_ID;
  const clientSecret = process.env.GITHUB_SYNC_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new GithubOAuthNotConfigured();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/integrations/github/callback`,
  };
}

export function isOAuthConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_SYNC_CLIENT_ID && process.env.GITHUB_SYNC_CLIENT_SECRET,
  );
}

export function newState(): string {
  return randomBytes(32).toString("base64url");
}

export function authorizeUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: GITHUB_SCOPES,
    state,
    allow_signup: "false",
  });
  return `${AUTHORIZE_URL}?${params}`;
}

/**
 * Canjea el `code` por un access token. GitHub responde 200 con un cuerpo de
 * error cuando el code no vale, así que hay que mirar el cuerpo y no el status.
 */
export async function exchangeCode(
  config: OAuthConfig,
  code: string,
): Promise<{ accessToken: string; refreshToken: string | null }> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!data.access_token) {
    throw new Error(
      data.error_description ?? data.error ?? "GitHub no devolvió ningún token.",
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
  };
}
