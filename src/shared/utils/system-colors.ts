import type { ColorValue } from "@/shared/types/enums";

const SYSTEM_COLORS: Record<ColorValue, string> = {
  red:    "red-500",
  blue:   "blue-500",
  pink:   "pink-500",
  purple: "purple-500",
  green:  "green-500",
  orange: "orange-500",
  yellow: "yellow-500",
  teal:   "teal-500",
  gray:   "gray-500",
  black:  "gray-900",
  white:  "gray-200",
};

/** Returns the Tailwind color class (e.g. "red-500"). Compose as needed: `text-${cls}`, `bg-${cls}`, `bg-${cls}/10` */
export function getSystemColor(color: string): string {
  return SYSTEM_COLORS[color as ColorValue] ?? "gray-500";
}

// Solid hex per color (mirrors Tailwind -500, with black→gray-900 / white→gray-200).
// Used for inline gradients where dynamic Tailwind classes can't be safelisted.
const SYSTEM_COLOR_HEX: Record<ColorValue, string> = {
  red:    "#ef4444",
  blue:   "#3b82f6",
  pink:   "#ec4899",
  purple: "#a855f7",
  green:  "#22c55e",
  orange: "#f97316",
  yellow: "#eab308",
  teal:   "#14b8a6",
  gray:   "#6b7280",
  black:  "#111827",
  white:  "#e5e7eb",
};

/** Returns the solid hex for a system color (e.g. "#3b82f6"), for inline styles. */
export function getSystemColorHex(color: string): string {
  return SYSTEM_COLOR_HEX[color as ColorValue] ?? "#6b7280";
}

/** Darkens a hex color by `percent` (0–100). Used to build the gradient end. */
export function darkenHex(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max(((num >> 8) & 0x00ff) - amt, 0);
  const B = Math.max((num & 0x0000ff) - amt, 0);
  return `#${(1 << 24 | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
}
