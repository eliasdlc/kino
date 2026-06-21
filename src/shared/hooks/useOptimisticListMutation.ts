"use client";

import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from "@tanstack/react-query";

/**
 * ── Patrón optimista canónico (Rumbo 05) ─────────────────────────────────────
 *
 * Toda mutación que cambie una lista cacheada por TanStack Query debe sentirse
 * instantánea y revertir limpio si el server falla. La forma es siempre la misma:
 *
 *   onMutate:  cancelQueries(key) → snapshot = getQueryData(key)
 *              → setQueryData(key, updater) → return { previous, key }
 *   onError:   setQueryData(key, previous)   // restaurar el snapshot
 *   onSettled: invalidateQueries(key)        // reconciliar con el server
 *
 * Este hook encapsula esa forma para el caso común: **una sola lista** (un
 * único query key) transformada por un `updater` puro. Cubre toggle / borrar /
 * editar / mover dentro de una lista.
 *
 * Cuándo NO usar este helper (copiar el patrón inline, documentado igual):
 *  - La mutación toca **varias** keys a la vez (p.ej. crear toca `bySystem` y
 *    `folderTasks`, o un bulk que escribe sobre todo el prefijo `['tasks']`).
 *  - Necesitas leer de una cache y escribir en otra (calendar ↔ allTasks).
 * En esos casos el helper se volvería abstracto/confuso; preferimos el patrón
 * explícito. El comentario de arriba es la fuente de verdad del patrón.
 */

/** Contexto que `onMutate` pasa a `onError`/`onSettled` para revertir. */
export type OptimisticListContext<TItem> = {
  /** Snapshot de la lista antes del cambio optimista. */
  previous: TItem[] | undefined;
  /** Key concreta sobre la que se aplicó el cambio (ya resuelta). */
  key: QueryKey;
};

type KeyOrFactory<TVariables> = QueryKey | ((variables: TVariables) => QueryKey);

export interface OptimisticListMutationOptions<
  TData,
  TError,
  TVariables,
  TItem,
> extends Omit<
    UseMutationOptions<TData, TError, TVariables, OptimisticListContext<TItem>>,
    "onMutate"
  > {
  /** Lista (query key) sobre la que se aplica el cambio. Puede depender de las variables. */
  queryKey: KeyOrFactory<TVariables>;
  /** Transforma la lista cacheada de forma pura. Recibe la copia previa (o []) y las variables. */
  updater: (previous: TItem[], variables: TVariables) => TItem[];
  /**
   * Key a invalidar en `onSettled`. Por defecto, la misma `queryKey`.
   * Útil para invalidar un prefijo más amplio (p.ej. `['tasks']`) cuando el
   * cambio afecta a varias vistas que cuelgan de ese prefijo.
   */
  invalidateKey?: KeyOrFactory<TVariables>;
}

function resolveKey<TVariables>(
  key: KeyOrFactory<TVariables>,
  variables: TVariables,
): QueryKey {
  return typeof key === "function"
    ? (key as (v: TVariables) => QueryKey)(variables)
    : key;
}

/**
 * Mutación optimista sobre una única lista cacheada.
 *
 * Aplica el snapshot/restore/invalidate por ti. Los callbacks que pases
 * (`onError`, `onSuccess`, `onSettled`) se ejecutan **después** del
 * comportamiento por defecto, así que un `onError` propio sirve para el toast
 * sin tener que repetir el rollback, y un `onSuccess` para mensajes/undo.
 *
 * @example
 * useOptimisticListMutation<ToggleResult, Error, string, Task>({
 *   mutationFn: (id) => fetch(`/api/tasks/${id}/toggle`, { method: 'POST' }).then(r => r.json()),
 *   queryKey: taskKeys.bySystem(systemId),
 *   updater: (tasks, id) =>
 *     tasks.map((t) => (t.id === id ? { ...t, status: t.status === 'done' ? 'today' : 'done' } : t)),
 *   invalidateKey: ['tasks'],
 *   onError: (err) => toast.error(err.message),
 * });
 */
export function useOptimisticListMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TItem = unknown,
>(options: OptimisticListMutationOptions<TData, TError, TVariables, TItem>) {
  const queryClient = useQueryClient();
  const { queryKey, updater, invalidateKey, onError, onSettled, ...rest } =
    options;

  return useMutation<TData, TError, TVariables, OptimisticListContext<TItem>>({
    ...rest,
    onMutate: async (variables) => {
      const key = resolveKey(queryKey, variables);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TItem[]>(key);
      queryClient.setQueryData<TItem[]>(key, (old = []) =>
        updater(old, variables),
      );
      return { previous, key };
    },
    // TanStack Query v5 pasa el resultado de onMutate como 3er argumento y un
    // `context` extra (cliente, meta…) como último. Reenviamos todo tal cual.
    onError: (error, variables, result, context) => {
      if (result) {
        queryClient.setQueryData(result.key, result.previous);
      }
      onError?.(error, variables, result, context);
    },
    onSettled: (data, error, variables, result, context) => {
      const key = invalidateKey
        ? resolveKey(invalidateKey, variables)
        : (result?.key ?? resolveKey(queryKey, variables));
      queryClient.invalidateQueries({ queryKey: key });
      onSettled?.(data, error, variables, result, context);
    },
  });
}
