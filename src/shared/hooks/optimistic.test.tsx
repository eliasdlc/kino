import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useOptimisticList, useOptimisticRecord, useOptimisticScope } from "./optimistic";

type Item = { id: string; label: string };

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useOptimisticList", () => {
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
        useOptimisticList<Item, Error, Item, Item>({
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
        useOptimisticList<Item, Error, Item, Item>({
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
        useOptimisticList<Item, Error, Item, Item>({
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
        useOptimisticList<Item, Error, Item, Item>({
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

  it("invalidates exactly the optimistic queryKey when no invalidateKey is given (KIN-49 invariant)", async () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () =>
        useOptimisticList<Item, Error, Item, Item>({
          mutationFn: async (item) => item,
          queryKey: KEY,
          updater: (items, item) => [...items, item],
        }),
      { wrapper: makeWrapper(client) },
    );

    result.current.mutate({ id: "2", label: "b" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // La key invalidada es exactamente la key escrita optimistamente: el estado
    // optimista no puede quedar huérfano sin reconciliarse.
    expect(spy).toHaveBeenCalledWith({ queryKey: KEY });
  });

  it("resolves a dynamic queryKey from the variables", async () => {
    const SCOPED = ["items", "scope-2"] as const;
    client.setQueryData<Item[]>(SCOPED, [{ id: "x", label: "x" }]);

    const { result } = renderHook(
      () =>
        useOptimisticList<Item, Error, { scope: string; item: Item }, Item>({
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

describe("useOptimisticRecord", () => {
  let client: QueryClient;
  const KEY = ["settings"] as const;
  const INITIAL = { theme: "dark", limit: 100 };

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(KEY, INITIAL);
  });

  function setup(mutationFn: (patch: Partial<typeof INITIAL>) => Promise<unknown>) {
    return renderHook(
      () =>
        useOptimisticRecord<unknown, Error, Partial<typeof INITIAL>, typeof INITIAL>({
          mutationFn,
          queryKey: KEY,
          updater: (previous, patch) => ({ ...previous, ...patch }),
        }),
      { wrapper: makeWrapper(client) },
    );
  }

  it("pinta el cambio antes de que responda el servidor", async () => {
    const { result } = setup(() => new Promise(() => {}));

    result.current.mutate({ theme: "light" });

    await waitFor(() => expect(client.getQueryData(KEY)).toEqual({ theme: "light", limit: 100 }));
  });

  it("devuelve el registro entero si el servidor lo rechaza", async () => {
    const { result } = setup(() => Promise.reject(new Error("no")));

    result.current.mutate({ theme: "light" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(KEY)).toEqual(INITIAL);
  });

  it("no inventa un registro donde no había nada cacheado", async () => {
    client.removeQueries({ queryKey: KEY });
    const { result } = setup(() => Promise.resolve({}));

    result.current.mutate({ theme: "light" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(KEY)).toBeUndefined();
  });
});

describe("useOptimisticScope", () => {
  let client: QueryClient;
  const PREFIX = ["tasks"] as const;
  const HOY = ["tasks", "today"] as const;
  const TODAS = ["tasks", "all"] as const;
  const OTRA = ["pages"] as const;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(HOY, [{ id: "1", label: "a" }]);
    client.setQueryData(TODAS, [{ id: "1", label: "a" }, { id: "2", label: "b" }]);
    client.setQueryData(OTRA, [{ id: "1", label: "a" }]);
  });

  function setup(mutationFn: (id: string) => Promise<unknown>) {
    return renderHook(
      () =>
        useOptimisticScope<unknown, Error, string, Item>({
          mutationFn,
          queryKey: PREFIX,
          updater: (items, id) => items.map((i) => (i.id === id ? { ...i, label: "hecho" } : i)),
        }),
      { wrapper: makeWrapper(client) },
    );
  }

  // Lo que el hook existe para evitar: la vista de delante actualizada y las
  // demás mintiendo hasta el siguiente refetch.
  it("escribe en todas las listas del prefijo a la vez", async () => {
    const { result } = setup(() => new Promise(() => {}));

    result.current.mutate("1");

    await waitFor(() => {
      expect(client.getQueryData<Item[]>(HOY)![0].label).toBe("hecho");
      expect(client.getQueryData<Item[]>(TODAS)![0].label).toBe("hecho");
    });
  });

  it("no toca lo que cuelga de otro prefijo", async () => {
    const { result } = setup(() => new Promise(() => {}));

    result.current.mutate("1");

    await waitFor(() => expect(client.getQueryData<Item[]>(HOY)![0].label).toBe("hecho"));
    expect(client.getQueryData<Item[]>(OTRA)![0].label).toBe("a");
  });

  it("las devuelve todas a su estado si el servidor falla", async () => {
    const { result } = setup(() => Promise.reject(new Error("no")));

    result.current.mutate("1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<Item[]>(HOY)![0].label).toBe("a");
    expect(client.getQueryData<Item[]>(TODAS)![0].label).toBe("a");
  });
});
