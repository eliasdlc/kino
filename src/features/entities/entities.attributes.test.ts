import { describe, expect, it } from "vitest";
import { parseEntityAttributes } from "./entities.attributes";

/**
 * El manifiesto de atributos es lo que impide que `attributes` se vuelva un saco.
 * KIN-140 le añadió el primer campo numérico (el orden in-world de un evento), así
 * que la coerción y el rechazo de claves ajenas tienen que seguir siendo firmes.
 */
describe("parseEntityAttributes", () => {
  it("acepta los campos del tipo y descarta los vacíos", () => {
    const result = parseEntityAttributes("character", {
      role: "Protagonista",
      age: "   ",
    });
    expect(result).toEqual({ success: true, data: { role: "Protagonista" } });
  });

  it("rechaza una clave que no declara el manifiesto", () => {
    const result = parseEntityAttributes("character", { inventado: "x" });
    expect(result.success).toBe(false);
  });

  it("rechaza un campo de otro tipo de entidad", () => {
    // `region` es de location: en un personaje no existe.
    expect(parseEntityAttributes("character", { region: "Norte" }).success).toBe(false);
  });

  it("convierte el orden in-world a número aunque llegue como string", () => {
    const result = parseEntityAttributes("event", { timelineOrder: "3" });
    expect(result).toEqual({ success: true, data: { timelineOrder: 3 } });
  });

  it("guarda el orden 0 como número, no como vacío", () => {
    const result = parseEntityAttributes("event", { timelineOrder: 0 });
    expect(result).toEqual({ success: true, data: { timelineOrder: 0 } });
  });

  it("rechaza un orden que no es un número", () => {
    expect(parseEntityAttributes("event", { timelineOrder: "hace mucho" }).success).toBe(
      false,
    );
  });

  it("un orden vacío se descarta antes de coercionar, no colapsa a 0", () => {
    const result = parseEntityAttributes("event", { timelineOrder: "", when: "Año 1023" });
    expect(result).toEqual({ success: true, data: { when: "Año 1023" } });
  });

  it("un objeto que queda vacío se guarda como null", () => {
    expect(parseEntityAttributes("event", { when: "  " })).toEqual({
      success: true,
      data: null,
    });
  });

  it("null y undefined pasan como null", () => {
    expect(parseEntityAttributes("event", null)).toEqual({ success: true, data: null });
    expect(parseEntityAttributes("event", undefined)).toEqual({
      success: true,
      data: null,
    });
  });

  it("el orden in-world convive con la etiqueta de texto", () => {
    const result = parseEntityAttributes("event", {
      when: "Año 1023, otoño",
      what: "Cayó el puente",
      timelineOrder: 2,
    });
    expect(result).toEqual({
      success: true,
      data: { when: "Año 1023, otoño", what: "Cayó el puente", timelineOrder: 2 },
    });
  });
});
