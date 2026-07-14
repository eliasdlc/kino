import { describe, expect, it } from "vitest";
import { toLikePattern } from "./search.types";

describe("toLikePattern", () => {
  it("envuelve el término entre comodines", () => {
    expect(toLikePattern("reunion")).toBe("%reunion%");
  });

  it("escapa los comodines de LIKE para tratarlos como literales", () => {
    // Sin escape, '50%' matchearía cualquier cosa que empiece por '50'.
    expect(toLikePattern("50%")).toBe("%50\\%%");
    expect(toLikePattern("a_b")).toBe("%a\\_b%");
    expect(toLikePattern("c\\d")).toBe("%c\\\\d%");
  });
});
