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
      return { backgroundColor: `color-mix(in srgb, ${css} 16%, transparent)`, color: glyphColor(css) };
    }
  }
}

/**
 * El color de un glifo de sistema: el suyo, con un tercio de tinta. El paso
 * 500 de la paleta sobre el papel claro queda bajo 3:1 en verde, amarillo,
 * naranja y turquesa (un icono necesita 3:1); mezclado con la tinta baja en
 * claro y sube en oscuro, así que gana contraste en los dos temas sin dejar
 * de ser el color que el usuario eligió.
 */
function glyphColor(css: string): string {
  return `color-mix(in oklab, ${css} 65%, var(--ink))`;
}

/** El color del glifo suelto (sidebar, índice): el del sistema, salvo los neutros que no se verían. */
export function systemGlyphStyle(color: string): CSSProperties {
  if (color === "white") return { color: "var(--ink)" };
  if (color === "gray" || color === "black") return { color: getSystemColorCss(color) };
  return { color: glyphColor(getSystemColorCss(color)) };
}
