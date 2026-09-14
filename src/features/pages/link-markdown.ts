/**
 * La sintaxis de Markdown para un enlace, sin nada de Tiptap alrededor.
 *
 * Vive aparte de la extensión porque es la parte que decide si algo se enlaza
 * o no, y eso se prueba sin montar un editor.
 */

/** Sólo los esquemas que el saneador deja pasar (`shared/lib/sanitize`). */
const ALLOWED_SCHEME = /^(https?:\/\/|mailto:)/i;

/** El texto no puede llevar corchetes; la dirección no puede llevar espacios. */
export const MARKDOWN_LINK = /\[([^[\]]+)\]\(([^\s()]+)\)$/;

/**
 * Lo que hay que enlazar, o `null` si lo escrito no es un enlace que se pueda
 * servir. Un esquema que el saneador borraría nunca llega a marcarse.
 */
export function parseMarkdownLink(text: string, href: string): { text: string; href: string } | null {
  if (ALLOWED_SCHEME.test(href)) return { text, href };
  // Una dirección escrita sin esquema es la forma normal de escribirla.
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(href)) return { text, href: `https://${href}` };
  return null;
}
