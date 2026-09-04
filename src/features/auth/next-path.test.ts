import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("acepta una ruta propia", () => {
    expect(safeNextPath("/systems/abc")).toBe("/systems/abc");
  });

  it("no deja salir del sitio", () => {
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });
});
