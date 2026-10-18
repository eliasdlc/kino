import type { CSSProperties } from "react";
import { getSystemColorCss } from "@/shared/utils/system-colors";

/**
 * El tile del icono de un sistema: el papel teñido con su color y el glifo en
 * ese color. En estilo en línea y no con `bg-${...}`, porque una clase armada
 * en tiempo de ejecución sólo existe si alguien la dejó en la safelist.
 *
 * Los tres neutros no tienen tinte que prestar: blanco y gris desaparecerían
 * sobre el papel, así que llevan el paso de superficie y el glifo en tinta o
 * en mute.
 */
export function systemTileStyle(color: string): CSSProperties {
  switch (color) {
    case "white":
      return { backgroundColor: "var(--sf2)", color: "var(--ink)" };
    case "gray":
      return { backgroundColor: "var(--sf2)", color: "var(--mute)" };
    case "black":
      return { backgroundColor: "color-mix(in srgb, var(--ink) 12%, transparent)", color: "var(--ink)" };
    default: {
      const css = getSystemColorCss(color);
      return { backgroundColor: `color-mix(in srgb, ${css} 16%, transparent)`, color: css };
    }
  }
}

/** El color del glifo suelto (sidebar, índice): el del sistema, salvo los neutros que no se verían. */
export function systemGlyphStyle(color: string): CSSProperties {
  if (color === "white") return { color: "var(--ink)" };
  return { color: getSystemColorCss(color) };
}
