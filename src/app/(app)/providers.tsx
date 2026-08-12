"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SystemTypeProvider } from "@/components/SystemTypeProvider";
import {
  createOfflineQueryClient,
  createOfflinePersistOptions,
} from "@/features/offline/offline.client";
import { applyPendingOptimistic } from "@/features/offline/offline.mutations";
import { useSyncOnlineManager } from "@/features/offline/offline.hooks";
import { useUnregisterLegacyServiceWorker } from "@/features/offline/service-worker";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createOfflineQueryClient);
  const [persistOptions] = useState(createOfflinePersistOptions);

  // El manager arranca creyéndose online; esto lo pone de acuerdo con el
  // navegador antes de que nada intente la primera petición (KIN-57).
  useSyncOnlineManager();
  useUnregisterLegacyServiceWorker();

  return (
    <ThemeProvider>
      <SystemTypeProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
          onSuccess={() => {
            // La cola ya está rehidratada. Primero se repinta lo que quedó
            // pendiente —para que al reabrir la app sin red siga viéndose— y
            // luego se intenta subir. Si no hay conexión, `resumePausedMutations`
            // simplemente las deja pausadas otra vez.
            applyPendingOptimistic(queryClient);
            return queryClient.resumePausedMutations();
          }}
        >
          {children}
        </PersistQueryClientProvider>
      </SystemTypeProvider>
    </ThemeProvider>
  );
}
