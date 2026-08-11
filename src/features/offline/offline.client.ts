"use client";

import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import { isOfflineCreateKey, registerOfflineMutationDefaults } from "./offline.mutations";

/**
 * Cola de captura offline persistida en IndexedDB (KIN-57).
 *
 * `localStorage` no sirve aquí: es síncrono, bloquea el hilo principal y tiene un
 * techo de ~5 MB compartido con todo lo demás. IndexedDB es asíncrono y sobra
 * espacio para una cola de creaciones.
 */

/** Sube este número si cambia la forma de las variables persistidas: invalida las colas viejas. */
const CACHE_BUSTER = "kin-57-v1";

/**
 * Cuánto aguanta la cola sin poder subir. Siete días es deliberadamente largo:
 * lo que hay dentro son ideas que el usuario escribió y cree guardadas, así que el
 * coste de tirarlas es mucho peor que el de conservarlas de más.
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const IDB_KEY = "kino-offline-queue";

/** IndexedDB no existe durante el render en servidor: allí la persistencia es un no-op. */
const storage = {
  getItem: async (key: string): Promise<string | null> =>
    typeof window === "undefined" ? null : ((await get<string>(key)) ?? null),
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window !== "undefined") await set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof window !== "undefined") await del(key);
  },
};

export function createOfflineQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  });

  // Antes de restaurar nada: sin los defaults registrados, una mutación
  // rehidratada sabe qué quería crear pero no cómo, y se queda encallada.
  registerOfflineMutationDefaults(queryClient);

  return queryClient;
}

export function createOfflinePersistOptions(): Omit<PersistQueryClientOptions, "queryClient"> {
  return {
    persister: createAsyncStoragePersister({ storage, key: IDB_KEY }),
    maxAge: MAX_AGE_MS,
    buster: CACHE_BUSTER,
    dehydrateOptions: {
      // Las *queries* no se persisten: leer sin conexión es otro ticket (KIN-62).
      // Persistirlas aquí guardaría media base de datos en el dispositivo sin que
      // nadie haya decidido todavía qué se cachea y por cuánto tiempo.
      shouldDehydrateQuery: () => false,
      // De las mutaciones, sólo las creaciones que quedaron pausadas por falta de
      // red. Un fallo real del servidor no se encola: eso revierte y avisa.
      shouldDehydrateMutation: (mutation) =>
        mutation.state.isPaused && isOfflineCreateKey(mutation.options.mutationKey),
    },
  };
}
