import { describe, expect, it } from "vitest";
import { checkSocialAuthRedirect } from "./social-auth-health";

const clerkUrl = "https://clerk.usekino.dev";

const clientIds = {
  google: "123456789-example.apps.googleusercontent.com",
  github: "Ov23abcdefghijklmnop",
} as const;

function providerRedirect(provider: "google" | "github", clientId: string = clientIds[provider]) {
  const host = provider === "google" ? "accounts.google.com" : "github.com";
  const path = provider === "google" ? "/o/oauth2/auth" : "/login/oauth/authorize";
  const redirect = new URL(path, `https://${host}`);
  redirect.searchParams.set("client_id", clientId);
  redirect.searchParams.set("redirect_uri", `${clerkUrl}/v1/oauth_callback`);
  return redirect.toString();
}

describe("social auth health", () => {
  it.each(["google", "github"] as const)("acepta el redirect configurado de %s", (provider) => {
    expect(checkSocialAuthRedirect(provider, providerRedirect(provider), clerkUrl)).toEqual({ ok: true });
  });

  it("detecta la conexión publicada sin client_id", () => {
    expect(checkSocialAuthRedirect("google", providerRedirect("google", ""), clerkUrl)).toEqual({
      ok: false,
      reason: "La conexión google está publicada sin client_id.",
    });
  });

  it.each([
    ["google", clientIds.github],
    ["github", clientIds.google],
  ] as const)("detecta un client_id de otro proveedor en %s", (provider, clientId) => {
    expect(checkSocialAuthRedirect(provider, providerRedirect(provider, clientId), clerkUrl)).toEqual({
      ok: false,
      reason: `El client_id publicado para ${provider} no tiene el formato de ese proveedor.`,
    });
  });

  it("detecta un callback que no pertenece a la instancia", () => {
    const redirect = new URL(providerRedirect("github"));
    redirect.searchParams.set("redirect_uri", "https://www.usekino.dev/api/auth/callback/github");

    expect(checkSocialAuthRedirect("github", redirect.toString(), clerkUrl)).toEqual({
      ok: false,
      reason: "La conexión github no vuelve al callback de Clerk.",
    });
  });
});
