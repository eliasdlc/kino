/**
 * Criterio: la frase que anotaste a proposito lleva resaltado suave, y el ancla
 * de posicion sigue sin decorar nada. Son dos clases de ancla y esta regla de
 * CSS es lo unico que las separa en pantalla, asi que se comprueba aqui: el dia
 * que alguien devuelva el subrayado punteado, este test lo nombra.
 *
 * Y el resaltado lleva el color de papel de su nota. El color llega por
 * decoracion, asi que la hoja de estilos nunca nombra un papel: solo dice
 * cuanto se mezcla el que le pasen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

/** El cuerpo de una regla de `globals.css`, por su selector exacto. */
function regla(selector: string): string {
  const inicio = CSS.indexOf(`\n${selector} {`);
  expect(inicio, `falta la regla ${selector}`).toBeGreaterThan(-1);
  const abre = CSS.indexOf("{", inicio);
  return CSS.slice(abre + 1, CSS.indexOf("}", abre));
}

describe("la frase anotada", () => {
  it("se pinta con resaltado y no con subrayado", () => {
    const cuerpo = regla(".sticky-anchor-mark");

    expect(cuerpo).toMatch(/background:\s*color-mix\(in srgb, var\(--ac\)/);
    expect(cuerpo).not.toContain("border-bottom");
  });

  it("reparte el redondeo por cada linea que ocupa la frase", () => {
    expect(regla(".sticky-anchor-mark")).toMatch(/\n\s+box-decoration-break:\s*clone/);
  });
});

describe("el ancla de posicion", () => {
  it("sigue sin decoracion despues del cambio de estilo", () => {
    const cuerpo = regla(".sticky-anchor-mark[data-anchor-muted]");

    expect(cuerpo).toMatch(/background:\s*transparent/);
    expect(cuerpo).toMatch(/padding:\s*0/);
  });
});

/** El porcentaje de una propiedad `--anchor-mix*` dentro del cuerpo de una regla. */
function mezcla(cuerpo: string, propiedad: string): number {
  const encontrado = cuerpo.match(new RegExp(`${propiedad}:\\s*(\\d+)%`));
  expect(encontrado, `falta ${propiedad}`).not.toBeNull();
  return Number(encontrado![1]);
}

describe("el color de la frase", () => {
  it("es el que trae la decoracion, no uno de la hoja de estilos", () => {
    const cuerpo = regla(".sticky-anchor-tint");

    expect(cuerpo).toMatch(
      /background:\s*color-mix\(in srgb, var\(--anchor-tint\) var\(--anchor-mix\), transparent\)/
    );
    // Ningun papel esta escrito aqui: los once viven en sticky-note-colors.ts.
    expect(cuerpo).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("cae a un gris cuando el papel no tiene color propio", () => {
    // Blanco y gris se pierden sobre la página clara y el negro se come el
    // texto: los tres papeles neutros se resaltan con el gris de rol.
    expect(regla(".sticky-anchor-tint")).toMatch(/--anchor-tint:\s*var\(--mute\)/);
  });

  it("aparta el ambar de la marca para que los dos lavados no se apilen", () => {
    const cuerpo = regla(".sticky-anchor-mark:has(.sticky-anchor-tint)");

    expect(cuerpo).toMatch(/background:\s*transparent/);
    expect(cuerpo).toMatch(/padding:\s*0/);
  });

  it("tine mas con un papel que con el gris, porque el pastel es casi blanco", () => {
    const neutro = mezcla(regla(".sticky-anchor-tint"), "--anchor-mix");
    const papel = mezcla(regla(".sticky-anchor-tint[data-anchor-paper]"), "--anchor-mix");

    expect(papel).toBeGreaterThan(neutro);
  });

  it("tine menos en oscuro, donde el texto encima del pastel es claro", () => {
    const claro = mezcla(regla(".sticky-anchor-tint[data-anchor-paper]"), "--anchor-mix");
    const oscuro = mezcla(regla(".dark .sticky-anchor-tint[data-anchor-paper]"), "--anchor-mix");

    expect(oscuro).toBeLessThan(claro);
  });
});

describe("la pareja encendida", () => {
  it("sube el mismo color en vez de cambiarlo", () => {
    const cuerpo = regla(".sticky-anchor-tint.sticky-anchor-lit");

    expect(cuerpo).toMatch(
      /background:\s*color-mix\(in srgb, var\(--anchor-tint\) var\(--anchor-mix-lit\), transparent\)/
    );
  });

  it("enciende por encima del reposo en los dos modos", () => {
    for (const selector of [
      ".sticky-anchor-tint",
      ".dark .sticky-anchor-tint",
      ".sticky-anchor-tint[data-anchor-paper]",
      ".dark .sticky-anchor-tint[data-anchor-paper]",
    ]) {
      const cuerpo = regla(selector);
      expect(mezcla(cuerpo, "--anchor-mix-lit"), selector).toBeGreaterThan(
        mezcla(cuerpo, "--anchor-mix")
      );
    }
  });

  it("lleva un halo del mismo color, que es lo que la enciende de verdad", () => {
    const cuerpo = regla(".sticky-anchor-tint.sticky-anchor-lit");

    // Una sola sombra, en el color del tinte: el halo no es una elevación.
    expect(cuerpo).toMatch(
      /box-shadow:\s*0 0 [\d.]+em [\d.]+em color-mix\(in srgb, var\(--anchor-tint\) var\(--anchor-glow\), transparent\)/
    );
    expect(cuerpo.match(/,\s*0 /g)).toBeNull();
  });

  it("define el halo en los cuatro casos de tinte y modo", () => {
    for (const selector of [
      ".sticky-anchor-tint",
      ".dark .sticky-anchor-tint",
      ".sticky-anchor-tint[data-anchor-paper]",
      ".dark .sticky-anchor-tint[data-anchor-paper]",
    ]) {
      expect(mezcla(regla(selector), "--anchor-glow"), selector).toBeGreaterThan(0);
    }
  });
});
