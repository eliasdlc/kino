/**
 * Criterio: los once colores de sistema se componen como clases de Tailwind y
 * los tres neutros (gray, black, white) son roles de la casa, no la escala
 * stock. getSystemColorCss devuelve un hex para los cromáticos y una variable
 * de rol para los neutros: vale para un estilo inline, nunca para pegarle un
 * alfa en hex. Un color desconocido cae al mute.
 */
import { describe, expect, it } from "vitest";
import { COLOR_VALUES } from "@/shared/types/enums";
import { getSystemColor, getSystemColorCss } from "./system-colors";

describe("system-colors", () => {
  it("los neutros son roles y los cromáticos clases de Tailwind", () => {
    expect(getSystemColor("gray")).toBe("mute");
    expect(getSystemColor("black")).toBe("ink");
    expect(getSystemColor("white")).toBe("sf2");
    expect(getSystemColor("blue")).toBe("blue-500");
    expect(getSystemColor("loquesea")).toBe("mute");
    for (const color of COLOR_VALUES) expect(getSystemColor(color)).not.toMatch(/gray|zinc|neutral|slate|stone/);
  });

  it("el valor CSS es hex para los cromáticos y variable de rol para los neutros", () => {
    expect(getSystemColorCss("red")).toMatch(/^#[0-9a-f]{6}$/);
    expect(getSystemColorCss("gray")).toBe("var(--mute)");
    expect(getSystemColorCss("black")).toBe("var(--ink)");
    expect(getSystemColorCss("white")).toBe("var(--sf2)");
    expect(getSystemColorCss("loquesea")).toBe("var(--mute)");
  });
});
