/**
 * Criterio: la cara display (Bricolage) va sólo en la cifra y los títulos de
 * pantalla. Ninguna primitiva de `components/ui` la usa: un botón, un chip,
 * una pestaña o una etiqueta en display es lo que hace que una pantalla lea
 * como un póster. `font-heading` sí está permitido: es el subhead, en Inter.
 * Si alguna primitiva mete la display, este test la nombra.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const UI = join(__dirname);

describe("las primitivas y la cara display", () => {
  it("ninguna primitiva usa font-display", () => {
    const culpables = readdirSync(UI)
      .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
      .filter((f) => /font-display\b/.test(readFileSync(join(UI, f), "utf8")));
    expect(culpables).toEqual([]);
  });
});
