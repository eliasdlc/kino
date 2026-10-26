/**
 * El punto de color de una etiqueta: el único mapa de la casa (había tres
 * copias). Los ocho cromáticos son la paleta física que la persona elige por
 * nombre, igual que el color de un sistema; los tres neutros son roles, para
 * que una etiqueta "gris" sea el gris del papel y no el de una escala ajena.
 * Clases estáticas, así Tailwind las conserva.
 */
const TAG_DOT: Record<string, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  pink: "bg-pink-500",
  purple: "bg-purple-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  teal: "bg-teal-500",
  gray: "bg-mute",
  black: "bg-ink",
  white: "bg-sf2 ring-1 ring-ln2",
};

/** Clase de fondo del punto de color para una etiqueta; un color que no existe cae al gris del papel. */
export function tagDotClass(color: string | null | undefined): string {
  return (color && TAG_DOT[color]) || TAG_DOT.gray;
}
