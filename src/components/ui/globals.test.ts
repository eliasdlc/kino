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
    // La regla de cierre es más específica y ganaría al bloque reducido.
    expect(reducido).toContain('[data-vaul-drawer][data-state="closed"]');
    expect(reducido).toContain("[data-vaul-overlay]");
  });
});

/* Contraste WCAG con luminancia relativa, sin librerías: el texto de tinte
   de cada rol (--ac-text y compañía) se lee sobre su tinte al 15 por ciento
   en reposo y al 25 en hover, encima de bg, sf y sf2, en claro y en oscuro.
   Un cambio de paleta que baje de 4,5 se nombra aquí. */
const hexARgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lineal = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminancia = ([r, g, b]: number[]) => 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
const contraste = (a: number[], b: number[]) => {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const mezcla = (a: number[], b: number[], pesoA: number) => a.map((v, i) => Math.round(v * pesoA + b[i] * (1 - pesoA)));

function paleta(bloque: string) {
  const hex = (token: string) => {
    const m = bloque.match(new RegExp(`^\\s*${token}: (#[0-9a-f]{6});`, "m"));
    if (!m) throw new Error(`falta ${token}`);
    return hexARgb(m[1]);
  };
  const texto = (rol: string) => {
    const m = bloque.match(new RegExp(`^\\s*--${rol}-text: color-mix\\(in srgb, var\\(--${rol}\\) (\\d+)%, var\\(--ink\\)\\);`, "m"));
    if (!m) throw new Error(`--${rol}-text no es una mezcla con tinta`);
    return mezcla(hex(`--${rol}`), hex("--ink"), Number(m[1]) / 100);
  };
  return { hex, texto };
}

describe("texto de tinte", () => {
  const claro = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));
  const oscuro = css.slice(css.indexOf(".dark {"));
  for (const [modo, bloque] of [["claro", claro], ["oscuro", oscuro]] as const) {
    it(`contrasta 4,5 o más sobre su tinte en ${modo}`, () => {
      const { hex, texto } = paleta(bloque);
      for (const rol of ["ac", "warn", "ok", "danger"]) {
        const tx = texto(rol);
        for (const superficie of ["--bg", "--sf", "--sf2"]) {
          const reposo = contraste(tx, mezcla(hex(`--${rol}`), hex(superficie), 0.15));
          const hover = contraste(tx, mezcla(hex(`--${rol}`), hex(superficie), 0.25));
          expect(reposo, `${rol} reposo sobre ${superficie} en ${modo}`).toBeGreaterThanOrEqual(4.5);
          expect(hover, `${rol} hover sobre ${superficie} en ${modo}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});
