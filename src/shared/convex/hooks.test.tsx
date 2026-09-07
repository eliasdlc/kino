import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `useMutation` de Convex se sustituye por una función que resuelve con sus
// argumentos: aquí se prueba el envoltorio, no el cliente.
vi.mock("convex/react", () => ({
  useMutation: () => async (args: unknown) => args,
  useAction: () => async (args: unknown) => args,
  useQuery: () => undefined,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

import type { FunctionReference } from "convex/server";
import { useConvexMutation } from "./hooks";

const fakeRef = {} as unknown as FunctionReference<"mutation", "public", { id: string }, { id: string }>;

describe("useConvexMutation", () => {
  it("mutate y mutateAsync no cambian de identidad aunque map y los callbacks sean funciones nuevas en cada render", () => {
    const { result, rerender } = renderHook(() =>
      useConvexMutation(fakeRef, { map: (v: { id: string }) => ({ ...v }), onSuccess: () => {} }),
    );
    const first = { mutate: result.current.mutate, mutateAsync: result.current.mutateAsync };
    rerender();
    rerender();
    expect(result.current.mutate).toBe(first.mutate);
    expect(result.current.mutateAsync).toBe(first.mutateAsync);
  });

  it("usa el map y el onSuccess del último render, no los del primero", async () => {
    let suffix = "a";
    const seen: string[] = [];
    const { result, rerender } = renderHook(() =>
      useConvexMutation(fakeRef, {
        map: (v: { id: string }) => ({ id: v.id + suffix }),
        onSuccess: (data) => seen.push((data as { id: string }).id + suffix),
      }),
    );
    suffix = "b";
    rerender();
    await act(async () => {
      await result.current.mutateAsync({ id: "x" });
    });
    expect(seen).toEqual(["xbb"]);
    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(true);
  });
});
