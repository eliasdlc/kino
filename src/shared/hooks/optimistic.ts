"use client";

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type UseMutationOptions,
} from "@tanstack/react-query";

/**
 * ── El patrón optimista, en sus tres formas ──────────────────────────────────
 *
 * Toda mutación que cambie algo cacheado por TanStack Query debe sentirse
 * instantánea y revertir limpio si el servidor falla. La forma es siempre la
 * misma:
 *
 *   onMutate:  cancelQueries → snapshot → escribir optimista → devolver snapshot
 *   onError:   restaurar el snapshot
 *   onSettled: invalidar para reconciliar con el servidor
 *
 * Lo que cambia entre un caso y otro no es esa forma, es **sobre qué** se
 * aplica. Por eso hay tres hooks y no uno:
 *
 *  - {@link useOptimisticList} — una lista bajo una key. Completar, borrar,
 *    editar o mover dentro de una lista.
 *  - {@link useOptimisticRecord} — un registro bajo una key. Ajustes, la ficha
 *    de la cuenta: un objeto, no una colección.
 *  - {@link useOptimisticScope} — todas las listas que cuelgan de un prefijo.
 *    Completar una tarea la ve el plan de hoy, la lista global y la del sistema;
 *    escribir sólo en una deja las otras dos descuadradas.
 *
 * La invalidación es parte de cada hook y no una decisión por mutación. Ahí
 * estaba el riesgo real: uno invalidaba un prefijo, otro una clave exacta, otro
 * las dos, y la diferencia sólo se notaba con dos vistas abiertas a la vez.
 *
 * Lo que no cabe aquí —leer de una cache y escribir en otra— se escribe inline
 * con un comentario diciendo por qué. Son dos casos y están señalados.
 */

/** Lo que `onMutate` deja para poder revertir. */
export type OptimisticContext<TSnapshot> = {
  previous: TSnapshot;
  key: QueryKey;
};

export type OptimisticListContext<TItem> = OptimisticContext<TItem[] | undefined>;
export type OptimisticRecordContext<TRecord> = OptimisticContext<TRecord | undefined>;
export type OptimisticScopeContext<TItem> = OptimisticContext<
  [QueryKey, TItem[] | undefined][]
>;

type KeyOrFactory<TVariables> = QueryKey | ((variables: TVariables) => QueryKey);

function resolveKey<TVariables>(key: KeyOrFactory<TVariables>, variables: TVariables): QueryKey {
  return typeof key === "function" ? (key as (v: TVariables) => QueryKey)(variables) : key;
}

interface BaseOptions<TVariables> {
  /** Qué se toca. Puede depender de las variables de la mutación. */
  queryKey: KeyOrFactory<TVariables>;
  /**
   * Qué invalidar al asentar. Por defecto, lo mismo que se tocó. Se sube a un
   * prefijo más amplio sólo cuando el cambio se ve desde otras vistas.
   */
  invalidateKey?: KeyOrFactory<TVariables>;
}

/**
 * El armazón común: cancelar, guardar, escribir, revertir, invalidar. Cada hook
 * le pasa cómo lee y cómo escribe su forma de cache.
 */
interface CacheAdapter<TVariables, TSnapshot> {
  snapshot: (client: QueryClient, key: QueryKey) => TSnapshot;
  apply: (client: QueryClient, key: QueryKey, variables: TVariables) => void;
  restore: (client: QueryClient, key: QueryKey, snapshot: TSnapshot) => void;
}

function useOptimistic<TData, TError, TVariables, TSnapshot>(
  options: Omit<
    UseMutationOptions<TData, TError, TVariables, OptimisticContext<TSnapshot>>,
    "onMutate"
  > &
    BaseOptions<TVariables>,
  { snapshot, apply, restore }: CacheAdapter<TVariables, TSnapshot>,
) {
  const queryClient = useQueryClient();
  const { queryKey, invalidateKey, onError, onSettled, ...rest } = options;

  return useMutation<TData, TError, TVariables, OptimisticContext<TSnapshot>>({
    ...rest,
    onMutate: async (variables) => {
      const key = resolveKey(queryKey, variables);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = snapshot(queryClient, key);
      apply(queryClient, key, variables);
      return { previous, key };
    },
    // TanStack Query v5 pasa el resultado de onMutate como 3er argumento y un
    // `context` extra (cliente, meta…) como último. Se reenvía todo tal cual.
    onError: (error, variables, result, context) => {
      if (result) restore(queryClient, result.key, result.previous);
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

export interface OptimisticListOptions<TData, TError, TVariables, TItem>
  extends Omit<
      UseMutationOptions<TData, TError, TVariables, OptimisticListContext<TItem>>,
      "onMutate"
    >,
    BaseOptions<TVariables> {
  /** Transforma la lista cacheada. Puro: recibe la copia previa (o []). */
  updater: (previous: TItem[], variables: TVariables) => TItem[];
}

/**
 * Mutación optimista sobre una lista cacheada.
 *
 * @example
 * useOptimisticList<ToggleResult, Error, string, TaskTransport>({
 *   mutationFn: (id) => api.tasks.toggle({ id }),
 *   queryKey: taskKeys.bySystem(systemId),
 *   updater: (tasks, id) => tasks.map((t) => (t.id === id ? { ...t, status: 'done' } : t)),
 *   invalidateKey: ['tasks'],
 * });
 */
export function useOptimisticList<TData = unknown, TError = Error, TVariables = void, TItem = unknown>(
  options: OptimisticListOptions<TData, TError, TVariables, TItem>,
) {
  const { updater, ...rest } = options;

  return useOptimistic<TData, TError, TVariables, TItem[] | undefined>(rest, {
    snapshot: (client, key) => client.getQueryData<TItem[]>(key),
    apply: (client, key, variables) =>
      client.setQueryData<TItem[]>(key, (old = []) => updater(old, variables)),
    restore: (client, key, previous) => client.setQueryData(key, previous),
  });
}

export interface OptimisticRecordOptions<TData, TError, TVariables, TRecord>
  extends Omit<
      UseMutationOptions<TData, TError, TVariables, OptimisticRecordContext<TRecord>>,
      "onMutate"
    >,
    BaseOptions<TVariables> {
  /** Transforma el registro cacheado. No se llama si todavía no hay nada. */
  updater: (previous: TRecord, variables: TVariables) => TRecord;
}

/**
 * Mutación optimista sobre un registro suelto: un objeto bajo una key, no una
 * colección. El control refleja la elección al instante y vuelve atrás si el
 * servidor la rechaza — sin esto, un select se queda pintando el valor viejo
 * hasta que responde el PATCH.
 */
export function useOptimisticRecord<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TRecord = unknown,
>(options: OptimisticRecordOptions<TData, TError, TVariables, TRecord>) {
  const { updater, ...rest } = options;

  return useOptimistic<TData, TError, TVariables, TRecord | undefined>(rest, {
    snapshot: (client, key) => client.getQueryData<TRecord>(key),
    apply: (client, key, variables) =>
      client.setQueryData<TRecord>(key, (old) =>
        old === undefined ? old : updater(old, variables),
      ),
    restore: (client, key, previous) => client.setQueryData(key, previous),
  });
}

export interface OptimisticScopeOptions<TData, TError, TVariables, TItem>
  extends Omit<
      UseMutationOptions<TData, TError, TVariables, OptimisticScopeContext<TItem>>,
      "onMutate"
    >,
    BaseOptions<TVariables> {
  /** Se aplica a cada lista que cuelgue del prefijo. */
  updater: (previous: TItem[], variables: TVariables) => TItem[];
}

/**
 * Mutación optimista sobre todas las listas de un prefijo.
 *
 * Es lo que hace falta cuando el mismo dato se ve desde varias vistas: una
 * tarea vive a la vez en el plan de hoy, en la lista global y en la de su
 * sistema, y escribir sólo en la que está en pantalla deja las otras mintiendo
 * hasta el siguiente refetch.
 */
export function useOptimisticScope<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TItem = unknown,
>(options: OptimisticScopeOptions<TData, TError, TVariables, TItem>) {
  const { updater, ...rest } = options;

  return useOptimistic<TData, TError, TVariables, [QueryKey, TItem[] | undefined][]>(rest, {
    snapshot: (client, key) => client.getQueriesData<TItem[]>({ queryKey: key }),
    apply: (client, key, variables) =>
      client.setQueriesData<TItem[]>({ queryKey: key }, (old) =>
        old === undefined ? old : updater(old, variables),
      ),
    restore: (client, _key, previous) => {
      for (const [snapshotKey, data] of previous) client.setQueryData(snapshotKey, data);
    },
  });
}
