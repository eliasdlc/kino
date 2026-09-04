import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MCP_TOKEN_AUDIENCE, MCP_TOKEN_ISSUER } from "@convex/lib/mcpToken";
import { mintConvexToken, publicJwks, scopeFor } from "./auth";

describe("scopeFor · de los scopes de Clerk al alcance de Convex", () => {
  it("sin ninguno de los tres, el conector sólo lee", () => {
    expect(scopeFor(["openid", "email", "profile"])).toBe("read");
    expect(scopeFor([])).toBe("read");
  });

  it("gana el más fuerte de los concedidos", () => {
    expect(scopeFor(["read", "propose"])).toBe("propose");
    expect(scopeFor(["read", "write"])).toBe("write");
    expect(scopeFor(["propose", "write", "openid"])).toBe("write");
  });

  it("acepta la forma con prefijo", () => {
    expect(scopeFor(["kino:propose"])).toBe("propose");
  });
});

describe("mintConvexToken · el token que Convex valida", () => {
  let jwks: ReturnType<typeof createLocalJWKSet>;
  const previous = process.env.KINO_MCP_SIGNING_JWK;

  beforeAll(async () => {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    const privateJwk = await exportJWK(privateKey);
    process.env.KINO_MCP_SIGNING_JWK = JSON.stringify(privateJwk);
    jwks = createLocalJWKSet(publicJwks(privateJwk));
  });

  afterAll(() => {
    process.env.KINO_MCP_SIGNING_JWK = previous;
  });

  it("lleva el id de Clerk en sub, el alcance en kino_scope y el emisor y audiencia compartidos", async () => {
    const token = await mintConvexToken({ clerkId: "user_123", scope: "propose" });
    const { payload, protectedHeader } = await jwtVerify(token, jwks, { issuer: MCP_TOKEN_ISSUER, audience: MCP_TOKEN_AUDIENCE });
    expect(protectedHeader.alg).toBe("ES256");
    expect(payload.sub).toBe("user_123");
    expect(payload.kino_scope).toBe("propose");
    expect(payload.exp! - payload.iat!).toBe(10 * 60);
  });

  it("la mitad pública no lleva la privada", () => {
    const { keys } = publicJwks({ kty: "EC", crv: "P-256", x: "x", y: "y", d: "secreto" });
    expect(keys[0]).not.toHaveProperty("d");
    expect(keys[0]).toMatchObject({ kid: "kino-mcp", alg: "ES256", use: "sig" });
  });
});
