/**
 * Criterio: la cara display (Bricolage) va sólo en títulos. En las primitivas
 * de `components/ui` la única excepción es el título de un overlay (diálogo,
 * hoja lateral, hoja inferior) y el de un estado vacío: un botón, un chip,
 * una pestaña o una etiqueta en display es lo que hace que una pantalla lea
 * como un póster. Literata es la voz (`font-voice`): sólo la frase del estado
 * vacío la usa; el resto de primitivas no la tocan.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const UI = join(__dirname);

/** Primitivas con un título de pantalla, y cuántas veces pueden decir display. */
const DISPLAY_PERMITIDO: Record<string, number> = {
  "dialog.tsx": 1,
  "drawer.tsx": 1,
  "sheet.tsx": 1,
  "empty-state.tsx": 1,
};
const VOZ_PERMITIDA = new Set(["empty-state.tsx"]);

const primitivas = () =>
  readdirSync(UI).filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"));

const veces = (texto: string, re: RegExp) => (texto.match(re) ?? []).length;

describe("las primitivas y las caras", () => {
  it("la display sólo aparece en el título de un overlay o de un estado vacío", () => {
    const culpables = primitivas().filter((f) => {
      const n = veces(readFileSync(join(UI, f), "utf8"), /font-display\b/g);
      return n > (DISPLAY_PERMITIDO[f] ?? 0);
    });
    expect(culpables).toEqual([]);
  });

  it("los overlays titulan en display", () => {
    for (const f of Object.keys(DISPLAY_PERMITIDO)) {
      expect(readFileSync(join(UI, f), "utf8"), f).toMatch(/font-display\b/);
    }
  });

  it("la voz (Literata) sólo habla en el estado vacío", () => {
    const culpables = primitivas()
      .filter((f) => !VOZ_PERMITIDA.has(f))
      .filter((f) => /font-(voice|serif|literata)\b/.test(readFileSync(join(UI, f), "utf8")));
    expect(culpables).toEqual([]);
  });
});
