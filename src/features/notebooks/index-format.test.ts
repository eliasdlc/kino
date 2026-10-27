/**
 * Criterio: el margen y la meta de una fila de índice dicen lo mismo en todas
 * las pantallas. El numeral romano de una carpeta, la cifra con su separador
 * de miles, el "hoy" y el "ayer" del documento y la meta unida por comas.
 */
import { describe, expect, it } from "vitest";
import { countNoun, formatCount, joinMeta, relativeDay, toRoman } from "./index-format";

describe("toRoman", () => {
  it("numera las carpetas en romano", () => {
    expect([1, 2, 4, 9, 14, 40, 90, 2026].map(toRoman)).toEqual(["I", "II", "IV", "IX", "XIV", "XL", "XC", "MMXXVI"]);
  });

  it("fuera del rango romano cae al arábigo en vez de inventar", () => {
    expect(toRoman(0)).toBe("0");
    expect(toRoman(4000)).toBe("4000");
  });
});

describe("formatCount", () => {
  it("agrupa los miles con punto también en cuatro cifras", () => {
    expect(formatCount(1240)).toBe("1.240");
    expect(formatCount(80000)).toBe("80.000");
    expect(formatCount(136)).toBe("136");
  });
});

describe("relativeDay", () => {
  const ahora = new Date(2026, 9, 18, 12);

  it("dice hoy y ayer, y la fecha corta sin punto después", () => {
    expect(relativeDay(new Date(2026, 9, 18, 8), ahora)).toBe("hoy");
    expect(relativeDay(new Date(2026, 9, 17, 23), ahora)).toBe("ayer");
    expect(relativeDay(new Date(2026, 8, 12), ahora)).toMatch(/^12 sept?$/);
  });

  it("sin fecha no dice nada", () => {
    expect(relativeDay(null, ahora)).toBeNull();
    expect(relativeDay("no es una fecha", ahora)).toBeNull();
  });
});

describe("meta", () => {
  it("cuenta con el sustantivo en número", () => {
    expect(countNoun(1, "manuscrito", "manuscritos")).toBe("1 manuscrito");
    expect(countNoun(3, "manuscrito", "manuscritos")).toBe("3 manuscritos");
  });

  it("une con comas y salta los huecos, nunca con punto medio", () => {
    expect(joinMeta(["Novela", null, "", false, "3 manuscritos"])).toBe("Novela, 3 manuscritos");
  });
});
