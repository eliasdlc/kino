import { describe, expect, it } from "vitest";
import { dueBeforeStart } from "./tasks.schemas";

describe("dueBeforeStart (FE-07)", () => {
  it("compara por día de calendario en días pelados", () => {
    expect(dueBeforeStart("2026-06-08", "2026-06-09")).toBe(true);
    expect(dueBeforeStart("2026-06-09", "2026-06-09")).toBe(false);
    expect(dueBeforeStart("2026-06-10", "2026-06-09")).toBe(false);
  });

  it("no rechaza el mismo día local aunque due tenga hora posterior", () => {
    const due = new Date(2026, 5, 9, 20, 0).toISOString();
    const start = new Date(2026, 5, 9, 8, 0).toISOString();
    expect(dueBeforeStart(due, start)).toBe(false);
  });

  it("detecta due un día local antes de start en el borde de medianoche", () => {
    // due 8-jun 23:00 local, start 9-jun 01:00 local → días 8 < 9.
    const due = new Date(2026, 5, 8, 23, 0).toISOString();
    const start = new Date(2026, 5, 9, 1, 0).toISOString();
    expect(dueBeforeStart(due, start)).toBe(true);
  });
});
