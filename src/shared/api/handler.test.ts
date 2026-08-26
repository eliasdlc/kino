import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { KINO_READ } from "@/shared/lib/scopes";

vi.mock("@/shared/db", () => ({ db: {} }));
vi.mock("@/shared/utils/auth-context", () => ({ getAuthContext: vi.fn() }));

const { getAuthContext } = await import("@/shared/utils/auth-context");
const { apiHandler } = await import("./handler");
const { apiContract } = await import("./contract.router");

/**
 * El borde del contrato: nadie entra sin credencial y nadie escribe con un
 * token de sólo lectura.
 *
 * No enumera endpoints a mano — los saca del contrato, así que uno nuevo queda
 * cubierto el día que se declara. Es lo mismo que `unauthenticated.test.ts` hace
 * con los `*.routes.ts` que todavía no están migrados.
 */

type Procedure = { "~orpc": { route: { method?: string; path?: string } } };

function procedures(): Array<{ name: string; method: string; path: string }> {
  const found: Array<{ name: string; method: string; path: string }> = [];
  for (const [slice, contract] of Object.entries(apiContract)) {
    for (const [name, procedure] of Object.entries(contract as Record<string, Procedure>)) {
      const { method, path } = procedure["~orpc"].route;
      if (method && path) found.push({ name: `${slice}.${name}`, method, path });
    }
  }
  return found;
}

/** La URL real de una operación, con un uuid en cada hueco de la ruta. */
function urlFor(path: string): string {
  const filled = path.replace(/\{(\+?)[^}]+\}/g, "11111111-1111-4111-8111-111111111111");
  return `http://localhost/api${filled}`;
}

function request(method: string, path: string) {
  return new NextRequest(urlFor(path), {
    method,
    ...(method === "GET"
      ? {}
      : { body: "{}", headers: { "content-type": "application/json" } }),
  });
}

async function respond(method: string, path: string) {
  const { matched, response } = await apiHandler.handle(request(method, path), {
    prefix: "/api",
    context: { request: request(method, path) },
  });
  return { matched, response };
}

const all = procedures();

beforeEach(() => {
  vi.mocked(getAuthContext).mockReset();
});

describe("contrato · el borde de autenticación", () => {
  it("el contrato declara al menos una operación", () => {
    expect(all.length).toBeGreaterThan(0);
  });

  it.each(all)("$name sin credencial contesta 401", async ({ method, path }) => {
    vi.mocked(getAuthContext).mockResolvedValue(null);

    const { matched, response } = await respond(method, path);

    expect(matched).toBe(true);
    expect(response!.status).toBe(401);
    expect(await response!.json()).toEqual({ code: "UNAUTHORIZED", message: "Unauthorized" });
  });

  const writes = all.filter((p) => p.method !== "GET");

  it.each(writes)("$name con un token de sólo lectura contesta 403", async ({ method, path }) => {
    vi.mocked(getAuthContext).mockResolvedValue({
      userId: "11111111-1111-4111-8111-111111111111",
      scopes: { kind: "oauth", granted: [KINO_READ] },
    });

    const { response } = await respond(method, path);

    expect(response!.status).toBe(403);
    expect(await response!.json()).toMatchObject({
      code: "INSUFFICIENT_SCOPE",
      requiredScope: "kino:write",
    });
  });
});

describe("contrato · lo que no existe", () => {
  it("una ruta que el contrato no declara no la reclama nadie", async () => {
    vi.mocked(getAuthContext).mockResolvedValue(null);

    const { matched } = await respond("GET", "/no-existe-esta-ruta");

    expect(matched).toBe(false);
  });
});
