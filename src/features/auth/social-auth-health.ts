export const socialAuthProviders = ["google", "github"] as const;

export type SocialAuthProvider = (typeof socialAuthProviders)[number];

const expectedHosts: Record<SocialAuthProvider, string> = {
  google: "accounts.google.com",
  github: "github.com",
};

const hasExpectedClientIdFormat: Record<SocialAuthProvider, (clientId: string) => boolean> = {
  google: (clientId) => clientId.endsWith(".apps.googleusercontent.com"),
  github: (clientId) => /^[A-Za-z0-9]{20}$/.test(clientId),
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

  const clientId = parsed.searchParams.get("client_id");
  if (!clientId) {
    return {
      ok: false,
      reason: `La conexión ${provider} está publicada sin client_id.`,
    };
  }

  if (!hasExpectedClientIdFormat[provider](clientId)) {
    return {
      ok: false,
      reason: `El client_id publicado para ${provider} no tiene el formato de ese proveedor.`,
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
