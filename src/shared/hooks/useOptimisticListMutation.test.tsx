import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useOptimisticListMutation } from "./useOptimisticListMutation";

type Item = { id: string; label: string };

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useOptimisticListMutation", () => {
  let client: QueryClient;
  const KEY = ["items"] as const;
  const INITIAL: Item[] = [{ id: "1", label: "a" }];

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    client.setQueryData<Item[]>(KEY, INITIAL);
  });

  it("applies the optimistic update immediately (before the server resolves)", async () => {
    const { result } = renderHook(
      () =>
        useOptimisticListMutation<Item, Error, Item, Item>({
          // Nunca resuelve: la mutación queda pending para observar el estado optimista.
          mutationFn: () => new Promise<Item>(() => {}),
          queryKey: KEY,
          updater: (items, item) => [...items, item],
        }),
      { wrapper: makeWrapper(client) },
    );

    result.current.mutate({ id: "2", label: "b" });

    await waitFor(() => {
      expect(client.getQueryData<Item[]>(KEY)).toHaveLength(2);
    });
  });

  it("rolls back to the snapshot on error and still runs the consumer onError", async () => {
    const onError = vi.fn();
    const { result } = renderHook(
      () =>
        useOptimisticListMutation<Item, Error, Item, Item>({
          mutationFn: async () => {
            throw new Error("boom");
          },
          queryKey: KEY,
          updater: (items, item) => [...items, item],
          onError,
        }),
      { wrapper: makeWrapper(client) },
    );

    result.current.mutate({ id: "2", label: "b" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // La UI volvió exactamente al estado previo.
    expect(client.getQueryData<Item[]>(KEY)).toEqual(INITIAL);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("keeps the optimistic result on success", async () => {
    const { result } = renderHook(
      () =>
        useOptimisticListMutation<Item, Error, Item, Item>({
          mutationFn: async (item) => item,
          queryKey: KEY,
          updater: (items, item) => [...items, item],
        }),
      { wrapper: makeWrapper(client) },
    );

    result.current.mutate({ id: "2", label: "b" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData<Item[]>(KEY)).toHaveLength(2);
  });

  it("invalidates a wider prefix via invalidateKey on settle", async () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () =>
        useOptimisticListMutation<Item, Error, Item, Item>({
          mutationFn: async (item) => item,
          queryKey: KEY,
          updater: (items, item) => [...items, item],
          invalidateKey: ["items", "wide"],
        }),
      { wrapper: makeWrapper(client) },
    );

    result.current.mutate({ id: "2", label: "b" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["items", "wide"] });
  });

  it("resolves a dynamic queryKey from the variables", async () => {
    const SCOPED = ["items", "scope-2"] as const;
    client.setQueryData<Item[]>(SCOPED, [{ id: "x", label: "x" }]);

    const { result } = renderHook(
      () =>
        useOptimisticListMutation<Item, Error, { scope: string; item: Item }, Item>({
          mutationFn: () => new Promise<Item>(() => {}),
          queryKey: (vars) => ["items", `scope-${vars.scope}`],
          updater: (items, vars) => [...items, vars.item],
        }),
      { wrapper: makeWrapper(client) },
    );

    result.current.mutate({ scope: "2", item: { id: "y", label: "y" } });

    await waitFor(() => {
      expect(client.getQueryData<Item[]>(SCOPED)).toHaveLength(2);
    });
    // La lista no relacionada queda intacta.
    expect(client.getQueryData<Item[]>(KEY)).toEqual(INITIAL);
  });
});
