/**
 * Qué se prueba: que las tres rutas de export exigen sesión de navegador, y
 * que el ZIP de datos entrega lo que el manifiesto promete, tabla por tabla.
 *
 * Viven fuera de Convex, así que el envoltorio que mira `kino_scope` no corre
 * y el modelo de alcances no se hereda. Sin esa barrera, un conector MCP con
 * alcance de sólo lectura resolvería identidad y se descargaría el workspace
 * entero en un ZIP, que es la fuga más grande que el producto puede tener.
 *
 * Y sin la segunda mitad, «workspace completo» vuelve a ser una afirmación:
 * este es el único test que puede demostrar que es cierta.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { EXPORT_TABLES, DATA_DIR } from "@/features/settings/export-manifest";

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
const { GET: exportarImagenes } = await import("./images/route");

const peticion = () => new NextRequest("http://localhost/api/export/workspace");
const params = Promise.resolve({ id: "k17system0000000000000000000001" });

beforeEach(() => {
  convex.query.mockReset();
  convex.mutation.mockReset();
});

describe("las rutas de export", () => {
  it("sin identidad ninguna de las tres responde", async () => {
    clerk.auth.mockResolvedValue({ userId: null, sessionId: null });

    expect((await exportarWorkspace()).status).toBe(401);
    expect((await exportarImagenes()).status).toBe(401);
    expect((await exportarSistema(peticion(), { params })).status).toBe(401);
    expect(convex.query).not.toHaveBeenCalled();
  });

  it("con identidad pero sin sesión tampoco: es el caso del conector MCP", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_ana", sessionId: null });

    expect((await exportarWorkspace()).status).toBe(401);
    expect((await exportarImagenes()).status).toBe(401);
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

/** N filas por tabla, con el sistema y las páginas que el Markdown necesita. */
const N = 25;

function cargaSembrada() {
  const tablas: Record<string, unknown[]> = {};
  for (const { tabla, formato } of EXPORT_TABLES) {
    if (formato === null) continue;
    tablas[tabla] = Array.from({ length: N }, (_, i) => ({ _id: `${tabla}-${i}`, nombre: `${tabla} ${i}` }));
  }
  tablas.systems = Array.from({ length: 3 }, (_, i) => ({ _id: `sys-${i}`, name: `Sistema ${i}` }));
  tablas.pages = Array.from({ length: N }, (_, i) => ({
    _id: `page-${i}`,
    // Dos capítulos homónimos a propósito: no se pueden pisar dentro del ZIP.
    title: i % 2 === 0 ? "La daga" : `Capítulo ${i}`,
    systemId: `sys-${i % 3}`,
    content: `<p>Filo de obsidiana</p><img src="https://blob.kino/${i}.webp">`,
  }));
  return { tablas, topadas: [], tope: 5000 };
}

describe("el ZIP de datos", () => {
  it("lleva un JSON por tabla que viaja, un Markdown por capítulo y su manifiesto", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_ana", sessionId: "sess_1" });
    convex.query.mockResolvedValue(cargaSembrada());

    const arrancó = Date.now();
    const respuesta = await exportarWorkspace();
    const zip = await JSZip.loadAsync(await respuesta.arrayBuffer());
    const tardó = Date.now() - arrancó;

    const viajan = EXPORT_TABLES.filter((t) => t.formato !== null);
    for (const { tabla } of viajan) {
      const json = zip.file(`${DATA_DIR}/${tabla}.json`);
      expect(json, `falta ${tabla}.json`).not.toBeNull();
    }
    expect(zip.file(`${DATA_DIR}/stickyNotes.json`)).not.toBeNull();
    expect(respuesta.headers.get("X-Kino-Tables")).toBe(String(viajan.length));
    // Un `.md` por capítulo con contenido, y dos homónimos que no se pisan.
    const markdown = Object.keys(zip.files).filter((n) => n.endsWith(".md"));
    expect(markdown).toHaveLength(N);
    expect(markdown.filter((n) => n.includes("la-daga"))).not.toHaveLength(0);
    expect(new Set(markdown).size).toBe(markdown.length);
    console.log(`ZIP de datos: ${viajan.length} tablas x ${N} filas en ${tardó} ms`);
    expect(tardó).toBeLessThan(8_000);
  });

  it("las imágenes salen reescritas a ruta relativa, aunque viajen en el otro ZIP", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_ana", sessionId: "sess_1" });
    convex.query.mockResolvedValue(cargaSembrada());

    const zip = await JSZip.loadAsync(await (await exportarWorkspace()).arrayBuffer());
    const md = await zip.file(Object.keys(zip.files).find((n) => n.endsWith(".md"))!)!.async("string");

    expect(md).toContain("../../assets/");
    expect(md).not.toContain("https://blob.kino/");
  });

  it("el manifiesto dice qué no viaja y por qué, y dónde están las imágenes", async () => {
    clerk.auth.mockResolvedValue({ userId: "user_ana", sessionId: "sess_1" });
    convex.query.mockResolvedValue(cargaSembrada());

    const zip = await JSZip.loadAsync(await (await exportarWorkspace()).arrayBuffer());
    const manifiesto = JSON.parse(await zip.file("manifiesto.json")!.async("string"));

    expect(manifiesto.tablas).toHaveLength(EXPORT_TABLES.length);
    for (const fila of manifiesto.tablas) {
      if (fila.viaja) expect(fila.formato).toBeTruthy();
      else expect(fila.motivo, `${fila.tabla} no viaja y no dice por qué`).toBeTruthy();
    }
    expect(manifiesto.imagenes.enlace).toBe("/api/export/images");
    expect(manifiesto.imagenes.referenciadas).toBe(N);
  });
});
