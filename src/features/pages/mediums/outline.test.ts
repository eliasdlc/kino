import { describe, expect, it } from "vitest";
import { deriveOutline, type OutlineDoc, type OutlineNode } from "./outline";

/**
 * Documento falso con la forma que expone un nodo ProseMirror: `forEach` entrega
 * cada hijo de nivel superior con su posición absoluta. Aquí las posiciones se
 * declaran a mano porque lo que se prueba es la derivación, no la aritmética de
 * ProseMirror.
 */
function doc(nodes: [name: string, text: string, pos: number, attrs?: Record<string, unknown>][]): OutlineDoc {
  return {
    forEach(fn: (node: OutlineNode, offset: number) => void) {
      for (const [name, textContent, pos, attrs] of nodes) {
        fn({ type: { name }, textContent, attrs: attrs ?? null }, pos);
      }
    },
  };
}

describe("deriveOutline", () => {
  it("no inventa escenas cuando el capítulo es prosa corrida", () => {
    expect(deriveOutline(doc([["paragraph", "Kael cruzó el puente.", 0]]))).toEqual([]);
  });

  it("el primer separador hace nacer también la escena que lo precede", () => {
    const items = deriveOutline(
      doc([
        ["paragraph", "Kael cruzó el puente al amanecer.", 0],
        ["sceneBreak", "", 40],
        ["paragraph", "Dahl esperaba al otro lado.", 42],
      ]),
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ pos: 0, kind: "scene" });
    expect(items[0].label).toBe("Escena 1 · Kael cruzó el puente al amanecer.");
    expect(items[1]).toMatchObject({ pos: 40, kind: "scene" });
    expect(items[1].label).toBe("Escena 2 · Dahl esperaba al otro lado.");
  });

  it("numera escenas por orden y trunca el texto largo", () => {
    const items = deriveOutline(
      doc([
        ["paragraph", "a", 0],
        ["sceneBreak", "", 2],
        ["paragraph", "x".repeat(80), 4],
        ["sceneBreak", "", 90],
        ["paragraph", "final", 92],
      ]),
    );

    expect(items.map((i) => i.label.split(" · ")[0])).toEqual([
      "Escena 1",
      "Escena 2",
      "Escena 3",
    ]);
    expect(items[1].label.endsWith("…")).toBe(true);
    expect(items[1].label.length).toBeLessThan(60);
  });

  it("numera páginas y paneles del guion por posición, no por atributo", () => {
    const items = deriveOutline(
      doc([
        ["mangaPage", "Kael entra al dojo", 0],
        ["mangaPage", "El golpe", 30],
        ["panel", "Cierre a negro", 60],
      ]),
    );

    expect(items.map((i) => ({ kind: i.kind, label: i.label }))).toEqual([
      { kind: "page", label: "Página 1 · Kael entra al dojo" },
      { kind: "page", label: "Página 2 · El golpe" },
      { kind: "panel", label: "Panel 1 · Cierre a negro" },
    ]);
  });

  it("el encabezado de escena del guion se lista con su propio texto", () => {
    const items = deriveOutline(
      doc([
        ["sceneHeading", "INT. CASA DE KAEL - NOCHE", 0],
        ["action", "Kael cierra la puerta.", 28],
        ["sceneHeading", "", 52],
      ]),
    );

    expect(items).toEqual([
      { pos: 0, kind: "scene", label: "INT. CASA DE KAEL - NOCHE", depth: 0, preview: "Kael cierra la puerta." },
      { pos: 52, kind: "scene", label: "Escena sin título", depth: 0, preview: null },
    ]);
  });

  it("los títulos sangran según su nivel", () => {
    const items = deriveOutline(
      doc([
        ["heading", "Acto I", 0, { level: 1 }],
        ["heading", "El puente", 10, { level: 2 }],
        ["heading", "", 24, { level: 3 }],
      ]),
    );

    expect(items.map((i) => [i.label, i.depth])).toEqual([
      ["Acto I", 0],
      ["El puente", 1],
      ["Sin título", 2],
    ]);
  });

  it("un separador seguido de un título no roba el texto del título", () => {
    const items = deriveOutline(
      doc([
        ["paragraph", "inicio", 0],
        ["sceneBreak", "", 8],
        ["heading", "Segunda parte", 10, { level: 2 }],
      ]),
    );

    expect(items.map((i) => i.label)).toEqual([
      "Escena 1 · inicio",
      "Escena 2",
      "Segunda parte",
    ]);
  });
});

describe("corte guía del plot grid (KIN-141)", () => {
  it("el corte que abre el capítulo no numera una escena nueva", () => {
    const items = deriveOutline(
      doc([
        ["sceneBreak", "", 0, { leading: true }],
        ["paragraph", "La niebla no levantó.", 2],
        ["sceneBreak", "", 30],
        ["paragraph", "Bruno la encontró.", 32],
      ]),
    );
    expect(items.map((i) => i.label)).toEqual([
      "Escena 1 · La niebla no levantó.",
      "Escena 2 · Bruno la encontró.",
    ]);
  });

  it("un corte guía que no está al principio se cuenta como separador normal", () => {
    const items = deriveOutline(
      doc([
        ["paragraph", "Uno.", 0],
        ["sceneBreak", "", 10, { leading: true }],
        ["paragraph", "Dos.", 12],
      ]),
    );
    expect(items).toHaveLength(2);
  });
});

describe("el preview de cada sección", () => {
  it("junta el texto de los bloques que van hasta el siguiente título", () => {
    const items = deriveOutline(
      doc([
        ["heading", "Tabla de símbolos", 0, { level: 2 }],
        ["paragraph", "Cada identificador entra aquí con su ámbito.", 20],
        ["paragraph", "La estructura es una tabla hash por nivel.", 70],
        ["heading", "Colisiones", 120, { level: 3 }],
      ]),
    );

    expect(items[0].preview).toBe(
      "Cada identificador entra aquí con su ámbito. La estructura es una tabla hash por nivel.",
    );
  });

  it("deja en null el preview de una sección sin cuerpo", () => {
    const items = deriveOutline(
      doc([
        ["heading", "Análisis léxico", 0, { level: 1 }],
        ["heading", "Autómatas finitos", 20, { level: 2 }],
        ["paragraph", "Un AFD no tiene transiciones vacías.", 44],
      ]),
    );

    expect(items[0].preview).toBeNull();
    expect(items[1].preview).toBe("Un AFD no tiene transiciones vacías.");
  });

  it("corta el cuerpo largo y lo termina en puntos suspensivos", () => {
    const items = deriveOutline(
      doc([
        ["heading", "Expresiones regulares", 0, { level: 2 }],
        ["paragraph", "palabra ".repeat(60), 24],
      ]),
    );

    const preview = items[0].preview ?? "";
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(181);
  });

  it("el último título del documento también cierra su preview", () => {
    const items = deriveOutline(
      doc([
        ["heading", "Cierre", 0, { level: 2 }],
        ["paragraph", "Lo último que dice el documento.", 12],
      ]),
    );

    expect(items[0].preview).toBe("Lo último que dice el documento.");
  });
});

describe("un documento fuera de los mediums de escritura", () => {
  it("devuelve solo sus títulos, en orden y con su nivel", () => {
    const items = deriveOutline(
      doc([
        ["heading", "Análisis léxico", 0, { level: 1 }],
        ["paragraph", "El lexer convierte caracteres en tokens.", 20],
        ["heading", "Autómatas finitos", 70, { level: 2 }],
        ["bulletList", "AFD, AFND", 100],
        ["heading", "AFD contra AFND", 130, { level: 3 }],
      ]),
    );

    expect(items.map((i) => [i.kind, i.label, i.depth])).toEqual([
      ["heading", "Análisis léxico", 0],
      ["heading", "Autómatas finitos", 1],
      ["heading", "AFD contra AFND", 2],
    ]);
  });

  it("no inventa una escena cuando no hay ningún separador", () => {
    const items = deriveOutline(
      doc([
        ["paragraph", "Un apunte que empieza sin título.", 0],
        ["heading", "Y luego uno", 40, { level: 2 }],
      ]),
    );

    expect(items.map((i) => i.kind)).toEqual(["heading"]);
  });
});
