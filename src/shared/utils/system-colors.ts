import type { ColorValue } from "@/shared/types/enums";

/**
 * Los once colores de sistema. Ocho son la paleta física de Tailwind, que el
 * usuario elige por nombre; los tres neutros (gray, black, white) son roles de
 * la casa, para que un sistema "gris" sea el gris del papel y no el de una
 * escala ajena.
 */
const SYSTEM_COLORS: Record<ColorValue, string> = {
  red:    "red-500",
  blue:   "blue-500",
  pink:   "pink-500",
  purple: "purple-500",
  green:  "green-500",
  orange: "orange-500",
  yellow: "yellow-500",
  teal:   "teal-500",
  gray:   "mute",
  black:  "ink",
  white:  "sf2",
};

/** Returns the Tailwind color class (e.g. "red-500"). Compose as needed: `text-${cls}`, `bg-${cls}`, `bg-${cls}/10` */
export function getSystemColor(color: string): string {
  return SYSTEM_COLORS[color as ColorValue] ?? "mute";
}

// Un valor CSS por color para estilos inline (gradientes, SVG), donde una
// clase dinámica no se puede safelistar. Los neutros leen su rol.
const SYSTEM_COLOR_CSS: Record<ColorValue, string> = {
  red:    "#ef4444",
  blue:   "#3b82f6",
  pink:   "#ec4899",
  purple: "#a855f7",
  green:  "#22c55e",
  orange: "#f97316",
  yellow: "#eab308",
  teal:   "#14b8a6",
  gray:   "var(--mute)",
  black:  "var(--ink)",
  white:  "var(--sf2)",
};

/** Returns a CSS color value for a system color: a hex for the eight chromatic ones, a role variable for the three neutrals. Never concatenate alpha onto it. */
export function getSystemColorCss(color: string): string {
  return SYSTEM_COLOR_CSS[color as ColorValue] ?? "var(--mute)";
}
