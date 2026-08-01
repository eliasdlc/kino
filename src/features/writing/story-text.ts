/**
 * Recorte de fragmentos para `search_story` (PLAN-11 §10). Puro y aparte del
 * servicio para poder probarlo: el filtrado grueso lo hace Postgres sobre el
 * HTML, pero la coincidencia que se le muestra al agente se confirma aquí, sobre
 * el texto ya limpio — buscar "la daga" no puede fallar porque en el HTML haya
 * un `<em>` en medio.
 */

const EXCERPT_RADIUS = 90;
const MAX_EXCERPTS_PER_PAGE = 3;

/** HTML del editor → texto plano legible, sin pegar palabras entre bloques. */
export function toPlainText(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<\/(p|li|h[1-6]|div|blockquote)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fragmentos alrededor de cada coincidencia, con elipsis donde se cortó. */
export function buildExcerpts(text: string, query: string): string[] {
  if (!query) return [];

  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const excerpts: string[] = [];

  let from = 0;
  while (excerpts.length < MAX_EXCERPTS_PER_PAGE) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    const start = Math.max(0, at - EXCERPT_RADIUS);
    const end = Math.min(text.length, at + needle.length + EXCERPT_RADIUS);
    excerpts.push(
      `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`,
    );
    from = at + needle.length;
  }

  return excerpts;
}
