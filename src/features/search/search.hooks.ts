import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { api } from "@/shared/api/client";
import { SEARCH_MIN_LENGTH } from "./search.types";

/**
 * Búsqueda global en vivo. Debouncea el término, solo consulta a partir de
 * {@link SEARCH_MIN_LENGTH} caracteres y conserva los resultados anteriores
 * mientras llega la nueva página (sin parpadeo entre teclas).
 */
export function useSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), 250);
  const enabled = debounced.length >= SEARCH_MIN_LENGTH;

  return useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.search.all({ q: debounced }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
