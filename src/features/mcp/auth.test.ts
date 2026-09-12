import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MCP_CLIENT_CLAIM, MCP_TOKEN_AUDIENCE, MCP_TOKEN_ISSUER } from "@convex/lib/mcpToken";
import { allows, SCOPES } from "@convex/lib/scopes";
import { ALL_TOOLS } from "./tools";
import { MCP_OAUTH_SCOPES, MCP_SCOPE_CONSENT, MCP_SCOPE_RESOURCE, mintConvexToken, publicJwks, scopeFor } from "./auth";

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

  it("acepta la forma con el recurso de Clerk delante", () => {
    expect(scopeFor(["documents:propose"])).toBe("propose");
    expect(scopeFor(["openid", "documents:write"])).toBe("write");
  });

  it("anuncia los tres con el recurso, como los conoce Clerk", () => {
    expect(MCP_OAUTH_SCOPES).toEqual(["openid", "email", "profile", "documents:read", "documents:propose", "documents:write"]);
  });
});

describe("el documento de recurso protegido", () => {
  it("publica exactamente los alcances que el envoltorio aplica, recorriendo SCOPES y no una lista a mano", () => {
    // La lista de arriba es el contrato visible; ésta es la comprobación de que
    // sale del mismo sitio que `allows`. Si mañana nace un cuarto alcance en
    // `convex/lib/scopes.ts`, la de arriba falla y ésta sigue verde: una dice
    // qué se publica hoy y la otra que no se publica nada que no se aplique.
    const publicados = MCP_OAUTH_SCOPES.filter((scope) => scope.startsWith(`${MCP_SCOPE_RESOURCE}:`));
    expect(publicados).toEqual(SCOPES.map((scope) => `${MCP_SCOPE_RESOURCE}:${scope}`));

    for (const scope of SCOPES) {
      // Publicado y aplicable son lo mismo: cada uno concede exactamente su
      // propio alcance y ninguno más fuerte.
      expect(scopeFor([`${MCP_SCOPE_RESOURCE}:${scope}`]), scope).toBe(scope);
      expect(allows(scope, scope), scope).toBe(true);
    }
  });

  it("la ruta sirve esa misma lista y no otra", async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??= "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk";
    const { GET } = await import("@/app/.well-known/oauth-protected-resource/[[...path]]/route");

    const documento = (await (await GET()).json()) as { scopes_supported: string[] };

    expect(documento.scopes_supported).toEqual([...MCP_OAUTH_SCOPES]);
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

  it("lleva el cliente OAuth que Clerk verificó, para que el origen no lo declare el agente", async () => {
    const token = await mintConvexToken({ clerkId: "user_123", scope: "propose", clientId: "claude_desktop" });
    const { payload } = await jwtVerify(token, jwks, { issuer: MCP_TOKEN_ISSUER, audience: MCP_TOKEN_AUDIENCE });

    expect(payload[MCP_CLIENT_CLAIM]).toBe("claude_desktop");
  });

  it("sin cliente el claim no viaja: el navegador no tiene origen que firmar", async () => {
    const token = await mintConvexToken({ clerkId: "user_123", scope: "write" });
    const { payload } = await jwtVerify(token, jwks, { issuer: MCP_TOKEN_ISSUER, audience: MCP_TOKEN_AUDIENCE });

    expect(payload).not.toHaveProperty(MCP_CLIENT_CLAIM);
  });

  it("la mitad pública no lleva la privada", () => {
    const { keys } = publicJwks({ kty: "EC", crv: "P-256", x: "x", y: "y", d: "secreto" });
    expect(keys[0]).not.toHaveProperty("d");
    expect(keys[0]).toMatchObject({ kid: "kino-mcp", alg: "ES256", use: "sig" });
  });
});

describe("el copy del consentimiento", () => {
  it("cada alcance tiene su frase, y ninguna sobra", () => {
    expect(Object.keys(MCP_SCOPE_CONSENT).sort()).toEqual([...SCOPES].sort());
    for (const [scope, frase] of Object.entries(MCP_SCOPE_CONSENT)) {
      expect(frase.length, scope).toBeGreaterThan(40);
    }
  });

  it("el copy dice que no puede borrar, y ninguna tool borra: las dos direcciones", () => {
    // Retirar las tools sin cambiar el copy deja el consentimiento prometiendo
    // borrar; cambiar el copy sin retirarlas lo deja prometiendo un límite que
    // el código no aplica, que es peor. Este test cierra las dos.
    expect(ALL_TOOLS.filter((tool) => tool.name.startsWith("delete_")).map((t) => t.name)).toEqual([]);
    expect(MCP_SCOPE_CONSENT.write).toContain("No puede borrar nada");
    // Y los dos alcances menores no pueden prometer más que el mayor.
    expect(MCP_SCOPE_CONSENT.read.toLowerCase()).not.toContain("borrar");
    expect(MCP_SCOPE_CONSENT.propose.toLowerCase()).not.toContain("borrar");
  });

  it("el catálogo y el copy comparten la política de edición de páginas", () => {
    const publicadas = new Set(ALL_TOOLS.map((tool) => tool.name));
    expect(publicadas.has("create_energy_checkin")).toBe(false);
    expect(publicadas.has("update_page")).toBe(true);
    expect(MCP_SCOPE_CONSENT.write).toContain("check-in de energía");
    expect(MCP_SCOPE_CONSENT.write).toContain("páginas creadas por agentes");
    expect(MCP_SCOPE_CONSENT.write).toContain("autorices expresamente");
  });
});
