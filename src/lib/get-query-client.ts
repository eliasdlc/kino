import { QueryClient } from "@tanstack/react-query";
import { cache } from "react";

/**
 * Server-side QueryClient singleton (per-request via React.cache).
 *
 * Use this in Server Components to prefetch data into the TanStack Query
 * cache before rendering client components. Wrap the client tree with
 * `<HydrationBoundary state={dehydrate(getQueryClient())}>`.
 *
 * The staleTime matches the client-side default in providers.tsx so
 * prefetched data is treated as fresh and avoids an immediate refetch.
 */
const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // match client default
        },
      },
    }),
);

export default getQueryClient;
