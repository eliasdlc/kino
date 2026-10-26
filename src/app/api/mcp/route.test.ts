import { beforeEach, describe, expect, it, vi } from "vitest";

// La ruta de verdad, con Clerk simulado: qué token acepta y si su `auth()` falla.
const clerk = vi.hoisted(() => ({
  auth: vi.fn(async () => ({})),
  verifyClerkToken: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: clerk.auth }));
vi.mock("@clerk/mcp-tools/next", () => ({ verifyClerkToken: clerk.verifyClerkToken }));

const { POST } = await import("./route");

// `reason` es lo que el middleware de Clerk deja en `x-clerk-auth-reason`.
const post = (bearer?: string, reason?: string) =>
  POST(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(reason ? { "x-clerk-auth-reason": reason } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }),
  );

describe("/api/mcp · el fallo de Kino y el token inválido no se confunden", () => {
  beforeEach(() => {
    delete process.env.KINO_MCP_SIGNING_JWK;
    clerk.auth.mockReset().mockResolvedValue({});
    clerk.verifyClerkToken.mockReset();
  });

  it("con un token que Clerk acepta y sin la clave de firma, responde 503 con el motivo", async () => {
    clerk.verifyClerkToken.mockReturnValue({ token: "oat_1", clientId: "claude", scopes: ["documents:write"], extra: { userId: "user_1" } });

    const res = await post("oat_1");

    expect(res.status).toBe(503);
    expect(res.headers.get("WWW-Authenticate")).toBeNull();
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("Falta KINO_MCP_SIGNING_JWK");
  });

  it("con un token que Clerk rechaza, 401 con la metadata del recurso", async () => {
    clerk.verifyClerkToken.mockReturnValue(undefined);

    const res = await post("oat_caducado");

    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("oauth-protected-resource/api/mcp");
  });

  it("si Clerk no puede verificar el token por un fallo suyo, 503 con su motivo, no 401", async () => {
    clerk.verifyClerkToken.mockReturnValue(undefined);

    for (const reason of ["unexpected-error", "secret-key-invalid"]) {
      const res = await post("oat_1", reason);
      expect(res.status, reason).toBe(503);
      const body = (await res.json()) as { error: { message: string } };
      expect(body.error.message).toContain(reason);
    }
  });

  it("si el token es el que falla, 401 aunque Clerk diga por qué", async () => {
    clerk.verifyClerkToken.mockReturnValue(undefined);

    for (const reason of ["token-invalid", "token-verification-failed", "token-type-mismatch"]) {
      expect((await post("oat_1", reason)).status, reason).toBe(401);
    }
  });

  it("sin token, aunque Clerk falle, 401: lo que toca es empezar el OAuth", async () => {
    clerk.auth.mockRejectedValue(new Error("clerkMiddleware no detectado"));

    const res = await post();

    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("oauth-protected-resource/api/mcp");
  });
});
