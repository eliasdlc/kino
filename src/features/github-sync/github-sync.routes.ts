import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { route } from "@/shared/utils/route";
import { getAuthContext } from "@/shared/utils/auth-context";
import { linkRepoSchema } from "./github-sync.schemas";
import {
  connectGithub,
  disconnectGithub,
  getConnectionStatus,
  linkRepo,
  syncSystem,
  unlinkRepo,
} from "./github-sync.service";
import { GithubApiError } from "./github-sync.types";
import {
  authorizeUrl,
  exchangeCode,
  GithubOAuthNotConfigured,
  isOAuthConfigured,
  newState,
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  readOAuthConfig,
} from "./github-sync.oauth";

type IdParam = { id: string };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Traduce los errores de GitHub a algo que la UI pueda mostrar. Un 401 sale como
 * 409 y no como 500: no es que la app se haya roto, es que hay que reconectar,
 * y el cliente necesita distinguirlo para ofrecer el botón correcto.
 */
function mapGithubError(error: unknown): NextResponse | null {
  if (error instanceof GithubApiError) {
    return NextResponse.json(
      {
        code: error.unauthorized ? "GITHUB_UNAUTHORIZED" : "GITHUB_ERROR",
        message: error.message,
      },
      { status: error.unauthorized ? 409 : 502 },
    );
  }
  if (error instanceof GithubOAuthNotConfigured) {
    return NextResponse.json(
      { code: "GITHUB_NOT_CONFIGURED", message: error.message },
      { status: 501 },
    );
  }
  return null;
}

async function withGithubErrors(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    const mapped = mapGithubError(error);
    if (mapped) return mapped;
    throw error;
  }
}

// ── Conexión ──

export const getGithubStatus = route()({}, async ({ userId }) =>
  withGithubErrors(async () =>
    NextResponse.json({
      ...(await getConnectionStatus(userId)),
      configured: isOAuthConfigured(),
    }),
  ),
);

export const deleteGithubStatus = route()({}, async ({ userId }) => {
  await disconnectGithub(userId);
  return new NextResponse(null, { status: 204 });
});

/**
 * Arranque del OAuth. No usa el wrapper `route()` porque la respuesta feliz es
 * un 302 hacia GitHub, no JSON.
 */
export async function startGithubOAuth(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.redirect(`${APP_URL}/login`);

  let config;
  try {
    config = readOAuthConfig();
  } catch (error) {
    const mapped = mapGithubError(error);
    if (mapped) return mapped;
    throw error;
  }

  const state = newState();
  const returnTo = new URL(request.url).searchParams.get("returnTo") ?? "/settings";

  const response = NextResponse.redirect(authorizeUrl(config, state));
  const secure = APP_URL.startsWith("https://");

  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600,
  });
  // Sólo rutas internas: un `returnTo` absoluto convertiría esto en un redirect
  // abierto hacia cualquier dominio.
  response.cookies.set(
    OAUTH_RETURN_COOKIE,
    returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/settings",
    { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 600 },
  );

  return response;
}

/** Vuelta de GitHub. Termina siempre en un redirect a la app, nunca en JSON. */
export async function githubOAuthCallback(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.redirect(`${APP_URL}/login`);

  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const expected = jar.get(OAUTH_STATE_COOKIE)?.value;
  const returnTo = jar.get(OAUTH_RETURN_COOKIE)?.value ?? "/settings";

  const fail = (motivo: string) => {
    const url = new URL(returnTo, APP_URL);
    url.searchParams.set("github", "error");
    url.searchParams.set("reason", motivo);
    return NextResponse.redirect(url);
  };

  const clear = (response: NextResponse) => {
    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.delete(OAUTH_RETURN_COOKIE);
    return response;
  };

  if (params.get("error")) return clear(fail(params.get("error")!));

  const state = params.get("state");
  const code = params.get("code");
  // Sin state guardado o con state distinto: o es un CSRF o la cookie caducó.
  if (!expected || !state || state !== expected) return clear(fail("state"));
  if (!code) return clear(fail("code"));

  try {
    const config = readOAuthConfig();
    const { accessToken, refreshToken } = await exchangeCode(config, code);
    await connectGithub(auth.userId, accessToken, refreshToken);
  } catch {
    return clear(fail("exchange"));
  }

  const url = new URL(returnTo, APP_URL);
  url.searchParams.set("github", "connected");
  return clear(NextResponse.redirect(url));
}

// ── Repositorio y sincronización de un sistema ──

export const postLinkRepo = route<IdParam>()(
  { body: linkRepoSchema },
  async ({ userId, params, body }) =>
    withGithubErrors(async () =>
      NextResponse.json(await linkRepo(params.id, userId, body)),
    ),
);

export const deleteLinkRepo = route<IdParam>()({}, async ({ userId, params }) => {
  await unlinkRepo(params.id, userId);
  return new NextResponse(null, { status: 204 });
});

export const postSyncSystem = route<IdParam>()({}, async ({ userId, params }) =>
  withGithubErrors(async () =>
    NextResponse.json(await syncSystem(params.id, userId)),
  ),
);
