import { beforeEach, describe, expect, it, vi } from "vitest";

// La ruta de verdad, con Clerk simulado: qué token acepta y si su `auth()` falla.
const clerk = vi.hoisted(() => ({
  auth: vi.fn(async () => ({})),
  verifyClerkToken: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: clerk.auth }));
vi.mock("@clerk/mcp-tools/next", () => ({ verifyClerkToken: clerk.verifyClerkToken }));

// Qué dice Convex del cliente (`mcpClients.registrar`), y si el servidor llega a montarse.
const kino = vi.hoisted(() => ({
  registrarCliente: vi.fn(async () => ({ revocado: false })),
  registerAllTools: vi.fn(),
}));
vi.mock("@/features/mcp/clients", async (original) => ({
  ...(await original<typeof import("@/features/mcp/clients")>()),
  registrarCliente: kino.registrarCliente,
}));
vi.mock("@/features/mcp/tools", () => ({ registerAllTools: kino.registerAllTools }));

const { POST } = await import("./route");

// `reason` y `message` son lo que el middleware de Clerk deja en `x-clerk-auth-reason` y `x-clerk-auth-message`.
const post = (bearer?: string, reason?: string, message?: string, body: unknown = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) =>
  POST(
    new Request("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(reason ? { "x-clerk-auth-reason": reason } : {}),
        ...(message ? { "x-clerk-auth-message": message } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

describe("/api/mcp · el fallo de Kino y el token inválido no se confunden", () => {
  beforeEach(() => {
    delete process.env.KINO_MCP_SIGNING_JWK;
    clerk.auth.mockReset().mockResolvedValue({});
    clerk.verifyClerkToken.mockReset();
    kino.registrarCliente.mockReset().mockResolvedValue({ revocado: false });
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
    const clave = "The provided Clerk Secret Key is invalid. Make sure that your Clerk Secret Key is correct.";
    expect((await post("oat_1", "token-verification-failed", clave)).status).toBe(503);
  });

  it("si el token es el que falla, 401 aunque Clerk diga por qué", async () => {
    clerk.verifyClerkToken.mockReturnValue(undefined);

    const delToken: [string, string?][] = [
      ["token-invalid", "Invalid JWT form. A JWT consists of three parts separated by dots."],
      ["token-verification-failed", "JWT is expired. Expiry date: Sat, 25 Oct 2026 20:00:00 GMT"],
      ["token-type-mismatch"],
    ];
    for (const [reason, message] of delToken) {
      expect((await post("oat_1", reason, message)).status, reason).toBe(401);
    }
  });

  it("sin token, aunque Clerk falle, 401: lo que toca es empezar el OAuth", async () => {
    clerk.auth.mockRejectedValue(new Error("clerkMiddleware no detectado"));

    const res = await post();

    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("oauth-protected-resource/api/mcp");
  });
});

describe("/api/mcp · un cliente desconectado en Ajustes no entra", () => {
  const CLAUDE_CODE = { token: "oat_1", clientId: "cli_viejo", scopes: ["documents:write"], extra: { userId: "user_1" } };
  const INITIALIZE = {
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude-code", version: "2.1.0" } },
  };

  beforeEach(() => {
    clerk.auth.mockReset().mockResolvedValue({});
    clerk.verifyClerkToken.mockReset().mockReturnValue(CLAUDE_CODE);
    kino.registrarCliente.mockReset().mockResolvedValue({ revocado: false });
    kino.registerAllTools.mockReset();
  });

  it("anota el client_id que verificó Clerk y el nombre que trae el initialize", async () => {
    await post("oat_1", undefined, undefined, INITIALIZE);

    expect(kino.registrarCliente).toHaveBeenCalledWith({
      clerkId: "user_1",
      clientId: "cli_viejo",
      scope: "write",
      clientName: "claude-code",
    });
  });

  it("revocado: 403 con acceso revocado desde Kino, sin desafío OAuth y sin montar el servidor", async () => {
    kino.registrarCliente.mockResolvedValue({ revocado: true });

    for (const body of [INITIALIZE, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_systems" } }]) {
      const res = await post("oat_1", undefined, undefined, body);
      expect(res.status).toBe(403);
      expect(res.headers.get("WWW-Authenticate")).toBeNull();
      const respuesta = (await res.json()) as { error: { message: string } };
      expect(respuesta.error.message).toContain("Acceso revocado desde Kino");
    }
    expect(kino.registerAllTools).not.toHaveBeenCalled();
  });

  it("un token sin client_id no pasa: 503 y el servidor no se monta", async () => {
    clerk.verifyClerkToken.mockReturnValue({ ...CLAUDE_CODE, clientId: undefined });

    const res = await post("oat_1");

    expect(res.status).toBe(503);
    const respuesta = (await res.json()) as { error: { message: string } };
    expect(respuesta.error.message).toContain("sin client_id");
    expect(kino.registrarCliente).not.toHaveBeenCalled();
    expect(kino.registerAllTools).not.toHaveBeenCalled();
  });

  it("si Convex no contesta, 503 con el motivo: sin saber si está revocado, no pasa", async () => {
    kino.registrarCliente.mockRejectedValue(new Error("Convex no respondió en 5000 ms al registrar el cliente"));

    const res = await post("oat_1");

    expect(res.status).toBe(503);
    const respuesta = (await res.json()) as { error: { message: string } };
    expect(respuesta.error.message).toContain("Convex no respondió");
    expect(kino.registerAllTools).not.toHaveBeenCalled();
  });
});
