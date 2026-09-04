import { useState } from "react";
import { api } from "@convex/_generated/api";
import { useConvexQuery } from "@/shared/convex/hooks";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { SEARCH_MIN_LENGTH, type SearchResult } from "./search.types";

/**
 * Búsqueda global en vivo. Debouncea el término, solo consulta a partir de
 * {@link SEARCH_MIN_LENGTH} caracteres y conserva los resultados anteriores
 * mientras llega la nueva página (sin parpadeo entre teclas).
 */
export function useSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), 250);
  const enabled = debounced.length >= SEARCH_MIN_LENGTH;
  const result = useConvexQuery(api.search.all, { q: debounced }, { enabled });
  // Los últimos resultados que llegaron, guardados durante el render para no
  // encadenar un efecto y un segundo render por cada tecla.
  const [previous, setPrevious] = useState<SearchResult[] | undefined>(undefined);
  if (result.data !== undefined && result.data !== previous) setPrevious(result.data);
  return { ...result, data: result.data ?? (enabled ? previous : undefined) };
}
