/**
 * Criterio: la onda sale del audio, no de un dibujo. Un silencio da barras a
 * cero y una grabación baja se ve con su propia forma, no aplastada contra una
 * escala absoluta.
 */
import { describe, expect, it } from "vitest";
import { BARRAS, duracionLegible, picosDe } from "./audio-peaks";

describe("picosDe", () => {
  it("un silencio da barras a cero, no barras inventadas", () => {
    const picos = picosDe(new Float32Array(4000));

    expect(picos).toHaveLength(BARRAS);
    expect(picos.every((pico) => pico === 0)).toBe(true);
  });

  it("guarda el pico de cada tramo, no su promedio", () => {
    // Dos tramos: el primero con un pico aislado, el segundo plano.
    const muestras = new Float32Array(20);
    muestras[3] = 1;
    for (let i = 10; i < 20; i += 1) muestras[i] = 0.5;

    const picos = picosDe(muestras, 2);

    expect(picos).toEqual([1, 0.5]);
  });

  it("una grabación baja se normaliza a su propia forma", () => {
    const muestras = new Float32Array(20);
    muestras[3] = 0.02;
    for (let i = 10; i < 20; i += 1) muestras[i] = 0.01;

    expect(picosDe(muestras, 2)).toEqual([1, 0.5]);
  });

  it("sin muestras no hay onda que dibujar", () => {
    expect(picosDe(new Float32Array(0))).toEqual([]);
  });
});

describe("duracionLegible", () => {
  it("se lee como una nota de voz", () => {
    expect(duracionLegible(47)).toBe("0:47");
    expect(duracionLegible(5)).toBe("0:05");
    expect(duracionLegible(125)).toBe("2:05");
  });

  it("un valor que el navegador todavía no sabe no imprime NaN", () => {
    expect(duracionLegible(Number.NaN)).toBe("0:00");
    expect(duracionLegible(Number.POSITIVE_INFINITY)).toBe("0:00");
    expect(duracionLegible(-1)).toBe("0:00");
  });
});
