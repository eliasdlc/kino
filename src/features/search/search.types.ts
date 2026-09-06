export type SearchResultType = "task" | "page" | "system";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  /** Sistema al que pertenece el resultado; null para páginas huérfanas. */
  systemId: string | null;
  /**
   * Fragmento del cuerpo donde apareció el término, con la coincidencia marcada
   * por {@link SNIPPET_OPEN} y {@link SNIPPET_CLOSE}. Es null cuando la
   * coincidencia fue sólo por título: repetir el título debajo del título no
   * aporta nada.
   */
  snippet: string | null;
}

/** Mínimo de caracteres para que una búsqueda tenga sentido. */
export const SEARCH_MIN_LENGTH = 2;

/**
 * Marcas de resaltado del fragmento. Son los caracteres de control STX y ETX
 * en vez de `<b>` a propósito: el fragmento sale del contenido del usuario, así
 * que devolverlo con HTML obligaría al cliente a un `dangerouslySetInnerHTML`.
 * Con caracteres imposibles en prosa el cliente parte la cadena y pinta la
 * marca con JSX, sin superficie de XSS.
 */
export const SNIPPET_OPEN = "\u0002";
export const SNIPPET_CLOSE = "\u0003";

/**
 * Parte un fragmento en tramos alternando texto normal y resaltado, para que
 * el cliente lo pinte sin interpretar HTML. El primer tramo siempre es normal
 * (puede ser vacío si el fragmento empieza por una coincidencia).
 */
export function splitSnippet(
  snippet: string,
): Array<{ text: string; match: boolean }> {
  const parts: Array<{ text: string; match: boolean }> = [];
  let rest = snippet;

  while (rest.length > 0) {
    const open = rest.indexOf(SNIPPET_OPEN);
    if (open === -1) {
      parts.push({ text: rest, match: false });
      break;
    }
    if (open > 0) parts.push({ text: rest.slice(0, open), match: false });

    const close = rest.indexOf(SNIPPET_CLOSE, open + 1);
    if (close === -1) {
      // Marca de apertura sin cierre: no debería pasar, pero no se pierde texto.
      parts.push({ text: rest.slice(open + 1), match: false });
      break;
    }
    parts.push({ text: rest.slice(open + 1, close), match: true });
    rest = rest.slice(close + 1);
  }

  return parts;
}

/**
 * Convierte el término del usuario en el texto de un `tsquery` con coincidencia
 * por prefijo en la última palabra.
 *
 * Por qué no `websearch_to_tsquery` directo: el Cmd+K busca mientras escribes, y
 * `websearch_to_tsquery('escrib')` no encuentra "escribir": sólo casa lexemas
 * completos. Sin el `:*` la búsqueda se sentiría peor que el `ILIKE` que sustituye
 * justo en el caso más común, que es el término a medio teclear. Se conserva la
 * semántica de `websearch_to_tsquery` para varias palabras: se combinan con AND.
 *
 * Es seguro frente a inyección porque cada palabra se reduce a letras y dígitos
 * antes de montar la expresión: los únicos metacaracteres que llegan a
 * `to_tsquery` son el ` & ` y el `:*` que pone esta función. Devuelve cadena
 * vacía si no queda nada buscable, y quien la llama debe cortar antes de
 * consultar: `to_tsquery('')` es un error en Postgres.
 */
export function toTsQueryText(term: string): string {
  const words = term
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((word) => word.length > 0);

  if (words.length === 0) return "";

  return words
    .map((word, i) => (i === words.length - 1 ? `${word}:*` : word))
    .join(" & ");
}
