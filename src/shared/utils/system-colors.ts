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
