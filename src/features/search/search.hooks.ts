import { keepPreviousData, useQuery } from "@tanstack/react-query";
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

  return useQuery<SearchResult[]>({
    queryKey: ["search", debounced],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debounced)}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
