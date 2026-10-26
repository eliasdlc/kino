/**
 * Criterio: la cabecera de un sistema lee tres cifras de lo que el sistema ya
 * sabe, y no pinta la que no tiene dato. El coral sólo va con la palabra que
 * dice el estado ("dormido"), y escritura lee palabras y sesiones, no tareas.
 * Una suma que salió de una lista cortada en su tope se dice como mínimo.
 */
import { describe, expect, it } from "vitest";
import { signalReadings, writingReadings } from "./system-readings";

const base = { status: "active" as const, stale: false, activeTaskCount: 3, nextDueDate: null, daysSinceLastActivity: 4 };

describe("signalReadings", () => {
  it("dice activas y días sin actividad, y calla la próxima entrega si no hay", () => {
    const r = signalReadings(base);
    expect(r.map((x) => x.label)).toEqual(["activas", "días sin actividad"]);
    expect(r.every((x) => x.tone === undefined)).toBe(true);
  });

  it("con próxima entrega la dice como fecha corta", () => {
    const r = signalReadings({ ...base, nextDueDate: new Date(2026, 8, 1).toISOString() });
    expect(r[1]).toMatchObject({ label: "próxima entrega" });
    expect(r[1].value).toMatch(/^1 sep/);
  });

  it("un sistema dormido lleva el coral y la palabra que lo dice", () => {
    const r = signalReadings({ ...base, stale: true, status: "stale", daysSinceLastActivity: 31 });
    expect(r.at(-1)).toEqual({ value: "31", label: "días dormido", tone: "warn" });
  });

  it("sin actividad nunca registrada no inventa los días", () => {
    expect(signalReadings({ ...base, daysSinceLastActivity: null }).map((x) => x.label)).toEqual(["activas"]);
  });
});

describe("writingReadings", () => {
  it("palabras de hoy, lo escrito contra la meta y los días sin sesión", () => {
    const r = writingReadings({ wordsToday: 0, totalWords: 136, wordGoal: 80000, daysSinceSession: 1, staleAfter: 3 });
    expect(r).toEqual([
      { value: "0", label: "palabras hoy" },
      { value: "136", label: "de 80.000" },
      { value: "1", label: "día sin sesión" },
    ]);
  });

  it("sin meta dice las palabras en total y, parada, se dice dormida en coral", () => {
    const r = writingReadings({ wordsToday: 250, totalWords: 1240, wordGoal: null, daysSinceSession: 31, staleAfter: 3 });
    expect(r[1]).toEqual({ value: "1.240", label: "palabras en total" });
    expect(r[2]).toEqual({ value: "31", label: "días dormido", tone: "warn" });
  });

  it("si la lista de manuscritos paró en su tope, la cifra es un mínimo y lo dice", () => {
    const r = writingReadings({ wordsToday: 0, totalWords: 48000, wordGoal: 80000, daysSinceSession: 1, staleAfter: 3, parcial: true });
    expect(r[1]).toEqual({ value: "48.000+", label: "de 80.000" });
  });
});
