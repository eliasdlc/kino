/**
 * Qué se prueba: que los dos 302 del OAuth de GitHub exigen sesión de
 * navegador.
 *
 * Viven fuera de Convex, así que el envoltorio que mira `kino_scope` no corre y
 * el modelo de alcances no se hereda. Sin esta barrera, un token del conector
 * con alcance de sólo lectura arrancaría el OAuth y acabaría guardando un
 * access token de GitHub cifrado en la cuenta, que es lo que `AGENTS.md` marca
 * como el caso de credenciales.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const clerk = vi.hoisted(() => ({
  auth: vi.fn<() => Promise<{ userId: string | null; sessionId: string | null }>>(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: clerk.auth }));

const convex = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn(), action: vi.fn() }));
vi.mock("@/shared/convex/server", () => ({
  serverQuery: convex.query,
  serverMutation: convex.mutation,
  serverAction: convex.action,
  convexToken: async () => "token",
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, delete: () => undefined }) }));

const { startGithubOAuth, githubOAuthCallback } = await import("./github-sync.routes");

const arranque = () => new NextRequest("http://localhost/api/integrations/github/connect");
const vuelta = () => new NextRequest("http://localhost/api/integrations/github/callback?code=x&state=y");

/** A dónde manda un 302, para distinguir "a GitHub" de "al login". */
const destino = (response: Response) => response.headers.get("location") ?? "";

beforeEach(() => {
  convex.action.mockReset();
});

describe("los dos 302 del OAuth de GitHub", () => {
  it("con identidad pero sin sesión no arrancan el OAuth: es el caso del conector", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_ana", sessionId: null });

    const inicio = await startGithubOAuth(arranque());
    expect(destino(inicio)).toContain("/login");
    expect(destino(inicio)).not.toContain("github.com");

    const callback = await githubOAuthCallback(vuelta());
    expect(destino(callback)).toContain("/login");
    // Y sobre todo: nunca se llega a canjear el código ni a guardar el token.
    expect(convex.action).not.toHaveBeenCalled();
  });

  it("sin identidad ninguna llega a GitHub", async () => {
    clerk.auth.mockResolvedValue({ userId: null, sessionId: null });

    expect(destino(await startGithubOAuth(arranque()))).not.toContain("github.com");
    expect(convex.action).not.toHaveBeenCalled();
  });
});
