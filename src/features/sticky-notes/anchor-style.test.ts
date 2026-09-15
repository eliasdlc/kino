/**
 * Criterio: la frase que anotaste a proposito lleva resaltado suave, y el ancla
 * de posicion sigue sin decorar nada. Son dos clases de ancla y esta regla de
 * CSS es lo unico que las separa en pantalla, asi que se comprueba aqui: el dia
 * que alguien devuelva el subrayado punteado, este test lo nombra.
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
