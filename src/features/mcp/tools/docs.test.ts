/**
 * Criterio: el documento se deriva del catálogo y no de una lista escrita a
 * mano, lleva exactamente las tools del catálogo y ninguna operación cerrada, y
 * ninguna de borrar aparece en él.
 */
import { describe, expect, it } from "vitest";
import { documentoDeApi, NOTA } from "./docs";
import { ALL_TOOLS } from "./index";

const doc = documentoDeApi();

describe("el documento de la API", () => {
  it("lleva tantas tools como el catálogo, ni una más", () => {
    expect(doc.tools).toHaveLength(ALL_TOOLS.length);
  });

  it("son exactamente las del catálogo, por nombre", () => {
    expect(doc.tools.map((tool) => tool.name).sort()).toEqual(ALL_TOOLS.map((tool) => tool.name).sort());
  });

  it("ninguna operación de borrado aparece en él", () => {
    const texto = JSON.stringify(doc).toLowerCase();

    expect(doc.tools.filter((tool) => /delete|borrar|eliminar/.test(tool.name))).toEqual([]);
    expect(texto).not.toContain('"name":"delete');
  });

  it("cada tool dice qué credencial hace falta, y son sólo tres alcances", () => {
    const perfiles = new Set(doc.tools.map((tool) => tool.perfil));

    expect(perfiles.size).toBeGreaterThan(0);
    for (const perfil of perfiles) expect(["read", "propose", "write"]).toContain(perfil);
  });

  it("la entrega de capturas se lee, y la resolución sólo propone", () => {
    const entrega = doc.tools.find((tool) => tool.name === "get_capture");
    const resolucion = doc.tools.find((tool) => tool.name === "resolve_capture");

    expect(entrega?.perfil).toBe("read");
    expect(resolucion?.perfil).toBe("propose");
  });

  it("cada tool publica la forma de su entrada, no una descripción de ella", () => {
    for (const tool of doc.tools) {
      expect(tool.input).toMatchObject({ type: "object" });
    }
  });

  it("dice quién pone los ojos, para que nadie tenga que deducirlo", () => {
    expect(doc.nota).toBe(NOTA);
    expect(doc.nota).toContain("no manda contenido a ningún modelo");
  });

  it("se deriva del catálogo: pasarle otro catálogo cambia el documento", () => {
    const soloUna = documentoDeApi([ALL_TOOLS[0]!]);

    expect(soloUna.tools).toHaveLength(1);
    expect(soloUna.tools[0]!.name).toBe(ALL_TOOLS[0]!.name);
  });
});
