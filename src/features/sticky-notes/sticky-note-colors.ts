/**
 * La paleta física de las notas: el papel y la tinta de cada color. Es una de
 * las tres paletas que viven fuera de los roles a propósito, porque es el
 * color de un objeto y no un estado. Sólo hex: las clases de Tailwind que
 * había al lado no las leía nadie.
 */
export const STICKY_NOTE_COLORS: Record<string, {
  /** El papel. */
  hex: string;
  /** La tinta sobre ese papel. */
  textHex: string;
  /** El nombre que se lee en voz alta y en la bandeja de colores. */
  label: string;
}> = {
  yellow: { hex: "#FFE066", textHex: "#4A3500", label: "Amarillo" },
  pink: { hex: "#FFB3C1", textHex: "#5C0A22", label: "Rosa" },
  blue: { hex: "#9CD8FF", textHex: "#093658", label: "Azul" },
  green: { hex: "#A8EDB0", textHex: "#0C3D12", label: "Verde" },
  purple: { hex: "#C9BCFF", textHex: "#1F0F5C", label: "Morado" },
  orange: { hex: "#FFC487", textHex: "#5A2A00", label: "Naranja" },
  teal: { hex: "#9CEFE2", textHex: "#053F38", label: "Turquesa" },
  red: { hex: "#FFA8A8", textHex: "#5A0000", label: "Rojo" },
  gray: { hex: "#E2E2E2", textHex: "#1F1F1F", label: "Gris" },
  black: { hex: "#33312E", textHex: "#F0EFEC", label: "Negro" },
  white: { hex: "#FCFBF7", textHex: "#1F1F1F", label: "Blanco" },
};

export const COLOR_PICKER_OPTIONS = Object.keys(STICKY_NOTE_COLORS) as Array<keyof typeof STICKY_NOTE_COLORS>;

/**
 * Papers with no colour of their own. Used as a highlight each of them fails on
 * one of the two backgrounds: white and gray vanish on the light page, black
 * swallows the text on it. Their sentence gets a neutral gray instead, which
 * reads on both and keeps the text legible.
 */
const NEUTRAL_PAPERS: ReadonlySet<string> = new Set(["white", "gray", "black"]);

/**
 * The colour that highlights the sentence a note of this paper annotates, or
 * `null` for a neutral paper, which has none to lend.
 */
export function anchorTint(color: string): string | null {
  if (NEUTRAL_PAPERS.has(color)) return null;
  return STICKY_NOTE_COLORS[color]?.hex ?? null;
}

/**
 * El papel pegado: en claro, la sombra única de la casa (la misma de la hoja
 * inferior); en oscuro `--shadow` vale `none` y la nota se separa por su
 * propio papel, que es el paso de tono. Va sola y no en una lista: `none`
 * dentro de una lista de sombras invalida la declaración entera.
 */
const PAPER_SHADOW = "var(--shadow)";

/**
 * Shared CSS for the Post-it paper surface (solid color + soft lifted shadow).
 *
 * `lit` is the note half of the note-and-sentence pair while the pointer is on
 * either of the two, including when it is on the sentence and not on the note.
 * Two layers, because one of them alone disappears on one of the backgrounds:
 * a ring in the paper's own ink, which reads over a pale yellow as well as over
 * the black paper, and a halo in the paper colour, which is what carries across
 * the dark page.
 */
export function paperStyle(hex: string, lit?: { ink: string }): React.CSSProperties {
  return {
    backgroundColor: hex,
    boxShadow: lit
      ? `0 0 0 2.5px color-mix(in srgb, ${lit.ink} 85%, transparent), ` +
        `0 0 1.5em 0.1em color-mix(in srgb, ${hex} 75%, transparent)`
      : PAPER_SHADOW,
  };
}
