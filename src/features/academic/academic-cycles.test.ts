/**
 * Criterio: un ciclo generado tiene que llamarse igual que en el portal de la
 * universidad y caer en el año académico correcto, incluido el caso que rompe
 * la intuición: enero y abril pertenecen al año que empezó en septiembre.
 * Y la lista de candidatos nunca puede ofrecer un ciclo que ya existe, porque
 * el backend lo rechaza por duplicado.
 */

import { describe, expect, it } from "vitest";
import {
  academicYear,
  availableCycles,
  cycleName,
  DEFAULT_CADENCE,
  generateCycles,
  resolveCadence,
} from "./academic-cycles";

describe("academic-cycles", () => {
  it("nombra el ciclo como el portal de PUCMM", () => {
    expect(cycleName(9, 2026)).toBe("Septiembre de 2026");
    expect(cycleName(1, 2027)).toBe("Enero de 2027");
    expect(cycleName(4, 2027)).toBe("Abril de 2027");
  });

  it("mete enero y abril en el año académico que abrió septiembre", () => {
    expect(academicYear(9, 2026, 9)).toBe("2026-2027");
    expect(academicYear(1, 2027, 9)).toBe("2026-2027");
    expect(academicYear(4, 2027, 9)).toBe("2026-2027");
    expect(academicYear(9, 2027, 9)).toBe("2027-2028");
  });

  it("marca actual el último ciclo que ya empezó", () => {
    const cycles = generateCycles(DEFAULT_CADENCE, new Date(2026, 8, 13));
    const current = cycles.find((cycle) => cycle.isCurrent);
    expect(current?.name).toBe("Septiembre de 2026");
    expect(current?.year).toBe("2026-2027");
  });

  it("no marca actual un ciclo que todavia no empezo", () => {
    const cycles = generateCycles(DEFAULT_CADENCE, new Date(2026, 7, 31));
    const current = cycles.find((cycle) => cycle.isCurrent);
    expect(current?.name).toBe("Abril de 2026");
  });

  it("devuelve los ciclos del mas nuevo al mas viejo", () => {
    const cycles = generateCycles(DEFAULT_CADENCE, new Date(2026, 8, 13), { back: 0, forward: 0 });
    expect(cycles.map((cycle) => cycle.name)).toEqual([
      "Septiembre de 2026",
      "Abril de 2026",
      "Enero de 2026",
    ]);
  });

  it("esconde los ciclos que ya existen", () => {
    const existing = [{ year: "2026-2027", name: "Septiembre de 2026" }];
    const names = availableCycles(DEFAULT_CADENCE, existing, new Date(2026, 8, 13)).map((cycle) => cycle.name);
    expect(names).not.toContain("Septiembre de 2026");
    expect(names).toContain("Enero de 2027");
  });

  it("cae en la cadencia de PUCMM cuando el sistema no declara ninguna", () => {
    expect(resolveCadence(undefined).startMonths).toEqual([9, 1, 4]);
    expect(resolveCadence([]).startMonths).toEqual([9, 1, 4]);
    expect(resolveCadence([8, 1]).id).toBe("dos");
    expect(resolveCadence([2, 6, 10]).id).toBe("propia");
  });
});
