export type SearchResultType = "task" | "page" | "note" | "tag" | "system";

/**
 * Las cinco fuentes, en el orden en que salen en la lista y en que el vacío las
 * nombra. Sale de aquí y no de un array por pantalla para que añadir una sexta
 * sea una línea y no tres sitios que se quedan viejos de uno en uno.
 */
export const SEARCH_SOURCES: ReadonlyArray<{ type: SearchResultType; heading: string; fuente: string }> = [
  { type: "task", heading: "Tareas", fuente: "tareas" },
  { type: "page", heading: "Capítulos", fuente: "capítulos" },
  { type: "note", heading: "Notas adhesivas", fuente: "notas adhesivas" },
  { type: "tag", heading: "Etiquetas", fuente: "etiquetas" },
  { type: "system", heading: "Sistemas", fuente: "nombres de sistema" },
];

/** Cuántos resultados enseña cada fuente. El resto se cuenta, no se pagina. */
export const SEARCH_PER_SOURCE = 8;

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  /** Sistema al que pertenece el resultado; null para etiquetas globales. */
  systemId: string | null;
  /** A dónde lleva. Un resultado sin sitio al que ir no se devuelve. */
  href: string;
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
