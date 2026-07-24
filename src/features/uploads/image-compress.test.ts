import { describe, it, expect } from "vitest";
import { computeTargetDimensions } from "./image-compress";

describe("computeTargetDimensions", () => {
  it("no escala si ya cabe dentro de maxDim", () => {
    expect(computeTargetDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("escala por el lado más largo (landscape)", () => {
    expect(computeTargetDimensions(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
  });

  it("escala por el lado más largo (portrait)", () => {
    expect(computeTargetDimensions(1600, 3200, 1600)).toEqual({ width: 800, height: 1600 });
  });

  it("mantiene proporción en casos no exactos", () => {
    const { width, height } = computeTargetDimensions(1000, 500, 600);
    expect(width).toBe(600);
    expect(height).toBe(300);
  });

  it("nunca colapsa a 0 en imágenes muy alargadas", () => {
    const { width, height } = computeTargetDimensions(4000, 10, 1600);
    expect(width).toBe(1600);
    expect(height).toBeGreaterThanOrEqual(1);
  });

  it("dimensiones inválidas → 0×0", () => {
    expect(computeTargetDimensions(0, 100, 1600)).toEqual({ width: 0, height: 0 });
  });
});
