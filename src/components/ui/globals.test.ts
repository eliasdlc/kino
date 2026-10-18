/**
 * Criterio: el sistema de Diario vive en globals.css con nombres que once
 * primitivas y el catálogo usan a ciegas: el foco único (focus-ring), el toque
 * (press), el fondo de overlay (--scrim), el margen (--margen), las cinco
 * duraciones y las dos curvas, y la regla que impone a la hoja de vaul el
 * movimiento de la casa. Renombrar cualquiera sin tocar este test se nombra
 * aquí, en vez de dejar un control sin foco o una hoja a 500 ms.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

describe("globals.css", () => {
  it("declara las utilidades y los tokens del sistema de Diario", () => {
    expect(css).toMatch(/@utility focus-ring\s*\{/);
    expect(css).toMatch(/@utility press\s*\{/);
    for (const token of ["--scrim", "--margen", "--dur-toque", "--dur-tachar", "--dur-pagina", "--dur-hoja", "--dur-cuenta", "--ease-pluma", "--ease-tinta", "--ac-text", "--ok-text", "--warn-text", "--danger-text"]) {
      expect(css, token).toMatch(new RegExp(`^\\s*${token}:`, "m"));
    }
    for (const utilidad of ["anim-entrar-pagina", "anim-subir-hoja", "anim-recoger-hoja", "anim-tachar"]) {
      expect(css, utilidad).toContain(`@utility ${utilidad}`);
    }
  });

  it("las entradas no dejan transform puesto y la hoja de vaul obedece al sistema", () => {
    expect(css).toMatch(/entrar-pagina var\(--dur-pagina\) var\(--ease-pluma\) backwards/);
    expect(css).toMatch(/subir-hoja var\(--dur-hoja\) var\(--ease-pluma\) backwards/);
    expect(css).toMatch(/\[data-vaul-drawer\]\s*\{[^}]*animation-duration: var\(--dur-hoja\) !important/);
    expect(css).toMatch(/\[data-vaul-drawer\]\[data-state="closed"\]\s*\{[^}]*var\(--ease-tinta\) !important/);
    const reducido = css.slice(css.indexOf("prefers-reduced-motion: reduce"));
    expect(reducido).toContain("[data-vaul-drawer]");
  });
});
