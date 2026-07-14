export type SearchResultType = "task" | "page" | "system";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  /** Sistema al que pertenece el resultado; null para páginas huérfanas. */
  systemId: string | null;
}

/** Mínimo de caracteres para que una búsqueda tenga sentido. */
export const SEARCH_MIN_LENGTH = 2;

/**
 * Convierte el término del usuario en un patrón LIKE seguro: escapa los
 * comodines de SQL (`%`, `_`, `\`) para que se traten como literales y no
 * como parte de la sintaxis del patrón.
 */
export function toLikePattern(term: string): string {
  const escaped = term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}
