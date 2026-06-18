/** Punto de color por categoría (clases estáticas → Tailwind las conserva). */
export const TAG_DOT: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  pink: "bg-pink-500",
  purple: "bg-purple-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  teal: "bg-teal-500",
  gray: "bg-gray-500",
  black: "bg-zinc-900",
  white: "bg-white border border-border",
};

/** Clase de fondo del punto de color para una categoría (fallback gris). */
export function tagDotClass(color: string | null | undefined): string {
  return (color && TAG_DOT[color]) || "bg-zinc-500";
}
