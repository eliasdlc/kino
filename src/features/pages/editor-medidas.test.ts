/**
 * Criterio: las dos medidas del editor que no pasan por el DOM. La cuenta de
 * palabras sobre el texto plano da lo mismo que la del HTML sin serializar
 * nada, y lo que tapa el teclado es la distancia entre el borde de abajo de la
 * ventana y el del viewport visual, nunca negativa. Y el título mide sus
 * líneas por su interlínea, como el párrafo de la primera pintura.
 */
import { describe, expect, it } from "vitest";
import { countPlainWords, countWords } from "@/shared/lib/word-count";
import { insetDelTeclado } from "./use-teclado-inset";
import { altoEnLineas } from "./NotebookEditor";

describe("countPlainWords", () => {
  it("cuenta lo mismo que countWords sobre el HTML del mismo texto", () => {
    const html = "<h2>Uno</h2><p>La cota del día marcaba 134</p><p>y nadie sabía leerla.</p>";
    const texto = "Uno La cota del día marcaba 134 y nadie sabía leerla.";
    expect(countPlainWords(texto)).toBe(countWords(html));
  });

  it("un documento vacío o en blanco tiene cero palabras", () => {
    expect(countPlainWords("")).toBe(0);
    expect(countPlainWords("   \n ")).toBe(0);
  });
});

describe("insetDelTeclado", () => {
  it("es lo que el viewport visual deja por debajo", () => {
    expect(insetDelTeclado(852, { height: 512, offsetTop: 0 })).toBe(340);
  });

  it("cuenta el desplazamiento de iOS al seguir el cursor", () => {
    expect(insetDelTeclado(852, { height: 512, offsetTop: 40 })).toBe(300);
  });

  it("sin teclado, o sin viewport visual, no tapa nada", () => {
    expect(insetDelTeclado(852, { height: 852, offsetTop: 0 })).toBe(0);
    expect(insetDelTeclado(852, null)).toBe(0);
  });
});

describe("altoEnLineas", () => {
  it("da líneas enteras de la interlínea aunque el scrollHeight sume unos píxeles", () => {
    expect(altoEnLineas(39, 35.904)).toBeCloseTo(35.904);
    expect(altoEnLineas(75, 35.904)).toBeCloseTo(71.808);
    expect(altoEnLineas(111, 35.904)).toBeCloseTo(107.712);
  });

  it("sin interlínea legible se queda con el scrollHeight", () => {
    expect(altoEnLineas(40, Number.NaN)).toBe(40);
  });
});
