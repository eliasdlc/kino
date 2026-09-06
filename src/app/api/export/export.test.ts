/**
 * Qué se prueba: que las dos rutas de export exigen sesión de navegador.
 *
 * Viven fuera de Convex, así que el envoltorio que mira `kino_scope` no corre
 * y el modelo de alcances no se hereda. Sin esta barrera, un conector MCP con
 * alcance de sólo lectura resolvería identidad y se descargaría el workspace
 * entero en un ZIP, que es la fuga más grande que el producto puede tener.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const clerk = vi.hoisted(() => ({
  auth: vi.fn<() => Promise<{ userId: string | null; sessionId: string | null }>>(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: clerk.auth }));

// El único consumidor real de Convex en estas rutas. Si la barrera falla, el
// test lo ve porque estas funciones llegan a llamarse.
const convex = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn() }));
vi.mock("@/shared/convex/server", () => ({
  serverQuery: convex.query,
  serverMutation: convex.mutation,
  serverAction: vi.fn(),
  convexToken: async () => "token",
}));

const { GET: exportarWorkspace } = await import("./workspace/route");
const { GET: exportarSistema } = await import("../systems/[id]/export/route");

const peticion = () => new NextRequest("http://localhost/api/export/workspace");
const params = Promise.resolve({ id: "k17system0000000000000000000001" });

beforeEach(() => {
  convex.query.mockReset();
  convex.mutation.mockReset();
});

describe("las rutas de export", () => {
  it("sin identidad ninguna de las dos responde", async () => {
    clerk.auth.mockResolvedValue({ userId: null, sessionId: null });

    expect((await exportarWorkspace(peticion())).status).toBe(401);
    expect((await exportarSistema(peticion(), { params })).status).toBe(401);
    expect(convex.query).not.toHaveBeenCalled();
  });

  it("con identidad pero sin sesión tampoco: es el caso del conector MCP", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_ana", sessionId: null });

    expect((await exportarWorkspace(peticion())).status).toBe(401);
    expect((await exportarSistema(peticion(), { params })).status).toBe(401);
    expect(convex.query).not.toHaveBeenCalled();
  });

  // Sin este caso los dos de arriba pasarían aunque la ruta reventara por
  // cualquier otro motivo: el 401 tiene que venir de la barrera.
  it("con sesión de navegador sí entra a leer", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_ana", sessionId: "sess_1" });
    convex.query.mockResolvedValue(null);

    expect((await exportarSistema(peticion(), { params })).status).toBe(404);
    expect(convex.query).toHaveBeenCalledWith(expect.anything(), { id: "k17system0000000000000000000001" });
  });
});
