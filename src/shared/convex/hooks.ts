"use client";

import { useCallback, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import type { Args } from "./loose";

/**
 * Los hooks de Convex con la forma que los componentes ya conocen de TanStack
 * Query: `data`, `isLoading`, `mutate`, `isPending`. Convex es reactivo, así
 * que una query no se refresca a mano: cuando la base cambia, cambia `data`.
 * Por eso `refetch` existe sólo para que el componente que lo llamaba siga
 * compilando, y no hace nada.
 */

export interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isPending: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: false;
  error: null;
  status: "pending" | "success";
  refetch: () => Promise<void>;
}

/** Una lectura reactiva. `enabled: false` o `"skip"` no se suscribe. */
export function useConvexQuery<Q extends FunctionReference<"query">>(
  query: Q,
  args: Args<Q> | "skip",
  options: { enabled?: boolean } = {},
): QueryResult<FunctionReturnType<Q>> {
  const skip = args === "skip" || options.enabled === false;
  const data = useQuery(query, ...(skip ? (["skip"] as const) : ([args as FunctionArgs<Q>] as [FunctionArgs<Q>])));
  const isLoading = !skip && data === undefined;
  return {
    data,
    isLoading,
    isPending: isLoading,
    isFetching: isLoading,
    isSuccess: data !== undefined,
    isError: false,
    error: null,
    status: data === undefined ? "pending" : "success",
    refetch: async () => {},
  };
}

export interface MutationCallbacks<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => unknown;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
}

export interface MutationResult<TData, TVariables> {
  mutate: (variables?: TVariables, callbacks?: MutationCallbacks<TData, TVariables>) => void;
  mutateAsync: (variables?: TVariables, callbacks?: MutationCallbacks<TData, TVariables>) => Promise<TData>;
  isPending: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  data: TData | undefined;
  variables: TVariables | undefined;
  reset: () => void;
}

type State<TData, TVariables> = {
  status: "idle" | "pending" | "success" | "error";
  data: TData | undefined;
  error: Error | null;
  variables: TVariables | undefined;
};

function useMutationState<TData, TVariables>(
  run: (variables: TVariables) => Promise<TData>,
  callbacks: MutationCallbacks<TData, TVariables>,
): MutationResult<TData, TVariables> {
  const [state, setState] = useState<State<TData, TVariables>>({ status: "idle", data: undefined, error: null, variables: undefined });

  const mutateAsync = useCallback(
    async (variables: TVariables = {} as TVariables, local: MutationCallbacks<TData, TVariables> = {}) => {
      setState({ status: "pending", data: undefined, error: null, variables });
      try {
        const data = await run(variables);
        setState({ status: "success", data, error: null, variables });
        await callbacks.onSuccess?.(data, variables);
        await local.onSuccess?.(data, variables);
        callbacks.onSettled?.(data, null, variables);
        local.onSettled?.(data, null, variables);
        return data;
      } catch (raw) {
        const error = raw instanceof Error ? raw : new Error(String(raw));
        setState({ status: "error", data: undefined, error, variables });
        callbacks.onError?.(error, variables);
        local.onError?.(error, variables);
        callbacks.onSettled?.(undefined, error, variables);
        local.onSettled?.(undefined, error, variables);
        throw error;
      }
    },
    // Los callbacks se leen en cada llamada a propósito: cambian con cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run],
  );

  const mutate = useCallback(
    (variables?: TVariables, local?: MutationCallbacks<TData, TVariables>) => {
      // El error ya llegó a `onError` y a `error`: aquí sólo se evita el rechazo suelto.
      void mutateAsync(variables, local).catch(() => {});
    },
    [mutateAsync],
  );

  return {
    mutate,
    mutateAsync,
    isPending: state.status === "pending",
    isLoading: state.status === "pending",
    isSuccess: state.status === "success",
    isError: state.status === "error",
    error: state.error,
    data: state.data,
    variables: state.variables,
    reset: () => setState({ status: "idle", data: undefined, error: null, variables: undefined }),
  };
}

/** Una mutación. `map` traduce las variables del componente a los argumentos de la función. */
export function useConvexMutation<M extends FunctionReference<"mutation">, TVariables = Args<M>>(
  mutation: M,
  options: MutationCallbacks<FunctionReturnType<M>, TVariables> & { map?: (variables: TVariables) => Args<M> } = {},
): MutationResult<FunctionReturnType<M>, TVariables> {
  const fn = useMutation(mutation);
  const { map } = options;
  const run = useCallback(
    (variables: TVariables) => fn((map ? map(variables) : variables) as FunctionArgs<M>),
    [fn, map],
  );
  return useMutationState(run, options);
}

/** Una acción, con la misma forma. */
export function useConvexAction<A extends FunctionReference<"action">, TVariables = Args<A>>(
  action: A,
  options: MutationCallbacks<FunctionReturnType<A>, TVariables> & { map?: (variables: TVariables) => Args<A> } = {},
): MutationResult<FunctionReturnType<A>, TVariables> {
  const fn = useAction(action);
  const { map } = options;
  const run = useCallback(
    (variables: TVariables) => fn((map ? map(variables) : variables) as FunctionArgs<A>),
    [fn, map],
  );
  return useMutationState(run, options);
}

/** Una mutación que no es una función de Convex: una descarga, una llamada a una ruta propia. */
export function useLocalMutation<TData, TVariables = void>(
  run: (variables: TVariables) => Promise<TData>,
  options: MutationCallbacks<TData, TVariables> = {},
): MutationResult<TData, TVariables> {
  return useMutationState(run, options);
}
