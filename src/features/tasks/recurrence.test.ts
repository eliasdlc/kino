import { describe, expect, it } from "vitest";
import {
  computeNextOccurrence,
  describeRecurrence,
  isValidRRule,
} from "./recurrence";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe("computeNextOccurrence", () => {
  it("FREQ=DAILY avanza un día", () => {
    const next = computeNextOccurrence("FREQ=DAILY", new Date(Date.UTC(2026, 5, 1)));
    expect(iso(next)).toBe("2026-06-02");
  });

  it("FREQ=WEEKLY desde un lunes cae en el siguiente lunes", () => {
    // 2026-06-01 es lunes.
    const next = computeNextOccurrence("FREQ=WEEKLY", new Date(Date.UTC(2026, 5, 1)));
    expect(iso(next)).toBe("2026-06-08");
  });

  it("FREQ=MONTHLY avanza al mismo día del mes siguiente", () => {
    const next = computeNextOccurrence("FREQ=MONTHLY", new Date(Date.UTC(2026, 5, 15)));
    expect(iso(next)).toBe("2026-07-15");
  });

  it("FREQ=WEEKLY;BYDAY=MO desde un miércoles cae en el próximo lunes", () => {
    // 2026-06-03 es miércoles → próximo lunes 2026-06-08.
    const next = computeNextOccurrence(
      "FREQ=WEEKLY;BYDAY=MO",
      new Date(Date.UTC(2026, 5, 3)),
    );
    expect(iso(next)).toBe("2026-06-08");
  });

  it("serie con COUNT agotado devuelve null", () => {
    const rule = "DTSTART:20260601T000000Z\nRRULE:FREQ=DAILY;COUNT=3";
    // La 3ª (y última) ocurrencia es 2026-06-03; después no hay más.
    const next = computeNextOccurrence(rule, new Date(Date.UTC(2026, 5, 3)));
    expect(next).toBeNull();
  });

  it("serie con UNTIL pasado devuelve null", () => {
    const rule = "DTSTART:20260601T000000Z\nRRULE:FREQ=DAILY;UNTIL=20260605T000000Z";
    const next = computeNextOccurrence(rule, new Date(Date.UTC(2026, 5, 10)));
    expect(next).toBeNull();
  });

  it("regla inválida devuelve null sin lanzar", () => {
    expect(computeNextOccurrence("no-es-rrule", new Date())).toBeNull();
  });
});

describe("isValidRRule", () => {
  it("acepta reglas válidas y el vacío (sin recurrencia)", () => {
    expect(isValidRRule("FREQ=WEEKLY;BYDAY=MO")).toBe(true);
    expect(isValidRRule(null)).toBe(true);
    expect(isValidRRule("")).toBe(true);
  });

  it("rechaza basura", () => {
    expect(isValidRRule("FREQ=NOPE")).toBe(false);
  });
});

describe("describeRecurrence", () => {
  it("traduce los presets a español", () => {
    expect(describeRecurrence("FREQ=DAILY")).toBe("Cada día");
    expect(describeRecurrence("FREQ=WEEKLY")).toBe("Cada semana");
    expect(describeRecurrence("FREQ=MONTHLY")).toBe("Cada mes");
  });

  it("lista los días de una semanal con BYDAY", () => {
    expect(describeRecurrence("FREQ=WEEKLY;BYDAY=MO,WE")).toBe(
      "Cada semana: lunes, miércoles",
    );
  });

  it("sin regla devuelve null", () => {
    expect(describeRecurrence(null)).toBeNull();
  });
});
