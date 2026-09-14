import { describe, expect, it } from "vitest";
import { activeFromCrossings } from "./outline-nav";

/**
 * Criterio: la marca encendida es la de la sección que se está leyendo, y solo
 * una. La regla vive aparte del observador precisamente para poder romperla
 * aquí: si devolviera el primer título cruzado en vez del último, o si no
 * cayera en la primera sección antes del primer cruce, esto se pone rojo.
 */
describe("activeFromCrossings", () => {
  const APUNTE = [0, 40, 90, 140];

  it("antes de cruzar nada, se está en la primera sección", () => {
    expect(activeFromCrossings(APUNTE, new Set())).toBe(0);
  });

  it("con tres títulos cruzados, la activa es la tercera y no la primera", () => {
    expect(activeFromCrossings(APUNTE, new Set([0, 40, 90]))).toBe(90);
  });

  it("volver a subir devuelve la activa a la sección de arriba", () => {
    expect(activeFromCrossings(APUNTE, new Set([0, 40]))).toBe(40);
  });

  it("el orden lo pone el documento, no el orden en que llegaron los cruces", () => {
    expect(activeFromCrossings(APUNTE, new Set([90, 0, 40]))).toBe(90);
  });

  it("un documento sin títulos no tiene sección activa", () => {
    expect(activeFromCrossings([], new Set())).toBeNull();
  });
});
