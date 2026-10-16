import { describe, it, expect } from "vitest";
import { dueDateHasTime } from "./tasks.utils";

describe("dueDateHasTime (FE-06)", () => {
  it("medianoche UTC (dato importado) = sin hora", () => {
    expect(dueDateHasTime("2026-06-09T00:00:00.000Z")).toBe(false);
  });

  it("medianoche local (dato de la app) = sin hora", () => {
    expect(dueDateHasTime(new Date(2026, 5, 9, 0, 0, 0, 0).toISOString())).toBe(false);
  });

  it("una hora significativa = con hora", () => {
    expect(dueDateHasTime(new Date(2026, 5, 9, 14, 30).toISOString())).toBe(true);
  });
});
