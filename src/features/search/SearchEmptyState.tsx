import { SEARCH_PER_SOURCE, SEARCH_SOURCES } from "./search.types";

/**
 * El vacío de la búsqueda. Dice dónde miró y hasta dónde, porque un hueco que
 * enumera sus fuentes es información y un hueco que sólo dice «sin resultados»
 * es una pared: con el primero sabes que tu nota adhesiva no existe, con el
 * segundo sólo que no la encontró.
 */
export function SearchEmptyState({ query }: { query: string }) {
  const fuentes = SEARCH_SOURCES.map((f) => f.fuente);
  const enumeradas = `${fuentes.slice(0, -1).join(", ")} ni ${fuentes.at(-1)}`;

  return (
    <div className="space-y-1 px-4 py-6 text-center">
      <p className="text-sm">
        Nada con «{query}» en {enumeradas}.
      </p>
      <p className="text-xs text-muted-foreground">
        De cada fuente se enseñan los {SEARCH_PER_SOURCE} primeros resultados.
      </p>
    </div>
  );
}
