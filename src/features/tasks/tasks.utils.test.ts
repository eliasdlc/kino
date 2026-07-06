import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deriveStatusFromDate, findParentViolation } from "./tasks.utils";

describe("findParentViolation", () => {
  // Cadena de padres en memoria: id -> parentId. Simula el lookup de la DB.
  const chain = (map: Record<string, string | null>) => async (id: string) => map[id] ?? null;

  it("detecta self-parent (una tarea no puede ser su propio padre)", async () => {
    expect(await findParentViolation("A", "A", chain({}))).toBe("self");
  });

  it("detecta ciclo directo A→B→A", async () => {
    // Asignar B como padre de A, cuando B ya tiene a A como padre.
    expect(await findParentViolation("A", "B", chain({ B: "A" }))).toBe("cycle");
  });

  it("detecta ciclo profundo A→C→B→A", async () => {
    expect(await findParentViolation("A", "C", chain({ C: "B", B: "A" }))).toBe("cycle");
  });

  it("permite un padre válido sin ciclo", async () => {
    expect(await findParentViolation("A", "B", chain({ B: null }))).toBeNull();
    expect(await findParentViolation("A", "C", chain({ C: "B", B: null }))).toBeNull();
  });

  it("no cuelga ante un ciclo preexistente ajeno al cambio", async () => {
    // B↔C ya forman ciclo entre ellos; asignar B como padre de A no involucra a A.
    expect(await findParentViolation("A", "B", chain({ B: "C", C: "B" }))).toBeNull();
  });
});

describe("deriveStatusFromDate", () => {
  beforeEach(() => {
    // Mock the system time to a fixed date for reliable tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 'backlog' if startDate is null or undefined", () => {
    expect(deriveStatusFromDate(null)).toBe("backlog");
    expect(deriveStatusFromDate(undefined)).toBe("backlog");
    expect(deriveStatusFromDate("")).toBe("backlog");
  });

  it("should return 'today' if startDate is today's date", () => {
    expect(deriveStatusFromDate("2026-05-18")).toBe("today");
  });

  it("should return 'tomorrow' if startDate is tomorrow's date", () => {
    expect(deriveStatusFromDate("2026-05-19")).toBe("tomorrow");
  });

  it("should return 'week' if startDate is past tomorrow", () => {
    expect(deriveStatusFromDate("2026-05-20")).toBe("week");
    expect(deriveStatusFromDate("2026-06-01")).toBe("week");
  });

  it("should return 'week' if startDate is in the past", () => {
    // A past date should technically be 'week' or handled by reconciliation.
    // The current logic defaults it to 'week' because it's not today or tomorrow.
    expect(deriveStatusFromDate("2026-05-17")).toBe("week");
    expect(deriveStatusFromDate("2025-01-01")).toBe("week");
  });
});
