"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  onlineManager,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { pendingCreationIds } from "./offline.mutations";

/**
 * ¿Hay conexión ahora mismo?
 *
 * Se apoya en el `onlineManager` de TanStack Query en vez de en un `navigator.onLine`
 * propio, para que la UI y la cola de mutaciones no puedan discrepar: si el indicador
 * dice "sin conexión" es exactamente porque la cola está pausada.
 *
 * En el servidor devuelve `true`: renderizar el aviso de "sin conexión" en el HTML
 * inicial provocaría un parpadeo en cada carga.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/**
 * Siembra el `onlineManager` con el estado real del navegador.
 *
 * Hace falta porque el manager arranca asumiendo `online = true` y sólo cambia de
 * opinión cuando llega un evento `online`/`offline`. En un arranque en frío ya sin
 * red —abrir la PWA en modo avión, que es el caso que este ticket tiene que
 * cubrir— nunca llega ese evento, así que sin esto la app se creería conectada,
 * intentaría cada petición y no pausaría la cola.
 */
export function useSyncOnlineManager(): void {
  useEffect(() => {
    onlineManager.setOnline(navigator.onLine);
  }, []);
}

/**
 * Ids de las creaciones que todavía no han llegado al servidor.
 *
 * Como el id del placeholder es el propio `clientRequestId` (ver `reconcile.ts`),
 * una fila cualquiera está pendiente si su id está en este conjunto — sin columnas
 * nuevas ni banderas repartidas por los tipos.
 */
export function usePendingCreationIds(): Set<string> {
  const queryClient = useQueryClient();
  const [ids, setIds] = useState<Set<string>>(() => pendingCreationIds(queryClient));

  useEffect(() => {
    const read = () => {
      const next = pendingCreationIds(queryClient);
      // Comparar contenido y no identidad: la mutation cache emite en cada
      // transición de estado y re-renderizar listas enteras por nada es caro.
      setIds((prev) =>
        prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next,
      );
    };
    read();
    return queryClient.getMutationCache().subscribe(read);
  }, [queryClient]);

  return ids;
}

/** ¿Está esta entidad esperando a subir? */
export function useIsPending(id: string | undefined): boolean {
  const pending = usePendingCreationIds();
  return id !== undefined && pending.has(id);
}

/** Cuántas creaciones esperan a subir. Alimenta el indicador de la UI. */
export function usePendingCreationCount(): number {
  return usePendingCreationIds().size;
}

/**
 * Estampa cada llamada con un `clientRequestId` fresco.
 *
 * Va aquí y no dentro del `mutationFn` a propósito: las variables son lo único que
 * se persiste de una mutación pausada, así que un id generado más adentro se
 * perdería al cerrar el navegador y la reproducción crearía una fila nueva en vez
 * de completar la que estaba a medias.
 *
 * Envuelve el resultado de `useMutation` sin cambiar su forma, así que los sitios
 * que ya llamaban `mutate(payload)` siguen igual.
 */
export function useStampedMutation<
  TData,
  TError,
  TVariables extends { clientRequestId?: string },
  TContext,
>(
  mutation: UseMutationResult<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { mutate: baseMutate, mutateAsync: baseMutateAsync } = mutation;

  const stamp = useCallback(
    (variables: TVariables): TVariables =>
      variables.clientRequestId
        ? variables
        : { ...variables, clientRequestId: crypto.randomUUID() },
    [],
  );

  const mutate = useCallback(
    (variables: TVariables, options?: Parameters<typeof baseMutate>[1]) =>
      baseMutate(stamp(variables), options),
    [baseMutate, stamp],
  );

  const mutateAsync = useCallback(
    (variables: TVariables, options?: Parameters<typeof baseMutateAsync>[1]) =>
      baseMutateAsync(stamp(variables), options),
    [baseMutateAsync, stamp],
  );

  return { ...mutation, mutate, mutateAsync } as UseMutationResult<
    TData,
    TError,
    TVariables,
    TContext
  >;
}
