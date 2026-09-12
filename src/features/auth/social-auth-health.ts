export const socialAuthProviders = ["google", "github"] as const;

export type SocialAuthProvider = (typeof socialAuthProviders)[number];

const expectedHosts: Record<SocialAuthProvider, string> = {
  google: "accounts.google.com",
  github: "github.com",
};

type RedirectCheck =
  | { ok: true }
  | { ok: false; reason: string };

/** Comprueba el redirect que Clerk entrega sin seguirlo ni iniciar sesión. */
export function checkSocialAuthRedirect(
  provider: SocialAuthProvider,
  redirect: string,
  clerkFrontendApiUrl: string,
): RedirectCheck {
  let parsed: URL;
  try {
    parsed = new URL(redirect);
  } catch {
    return { ok: false, reason: "Clerk no devolvió una URL válida." };
  }

  if (parsed.hostname !== expectedHosts[provider]) {
    return {
      ok: false,
      reason: `Clerk dirigió ${provider} a ${parsed.hostname || "un host vacío"}.`,
    };
  }

  if (!parsed.searchParams.get("client_id")) {
    return {
      ok: false,
      reason: `La conexión ${provider} está publicada sin client_id.`,
    };
  }

  const expectedCallback = new URL("/v1/oauth_callback", clerkFrontendApiUrl).toString();
  if (parsed.searchParams.get("redirect_uri") !== expectedCallback) {
    return {
      ok: false,
      reason: `La conexión ${provider} no vuelve al callback de Clerk.`,
    };
  }

  return { ok: true };
}
