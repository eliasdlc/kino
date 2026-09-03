import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimisticList } from "@/shared/hooks/optimistic";
import { api } from "@/shared/api/client";
import type {
  SystemTransport,
  SystemWithSignalsTransport,
  CreateSystemInput,
  UpdateSystemInput,
} from "./systems.types";
import { folderKeys } from "@/features/folders/folders.hooks";
import { pageKeys } from "@/features/pages/pages.hooks";
import { taskKeys } from "@/features/tasks/tasks.hooks";
import { resolveSystemManifest } from "@/shared/lib/system-manifest";
import type { ArchetypeManifest } from "@/shared/lib/system-types";

export function useSystems() {
  return useQuery({
    queryKey: ["systems"],
    queryFn: () => api.systems.list({}),
    refetchOnWindowFocus: true,
  });
}

/**
 * La versión viva de un sistema que llegó como prop de un server component.
 * Las vistas de detalle reciben la fila renderizada en el servidor y no se
 * re-renderizan al mutar; la lista `["systems"]` sí (mutación optimista), así
 * que componer un sistema se ve al instante en vez de al navegar.
 */
export function useLiveSystem<T extends SystemTransport>(system: T): T {
  const { data } = useSystems();
  const live = data?.find((s) => s.id === system.id) as T | undefined;
  return live ?? system;
}

/**
 * Manifiesto efectivo de un sistema a partir de su id. Para componentes que solo
 * conocen el `systemId` (las vistas del funnel de tareas, que se montan igual
 * desde un sistema que desde una carpeta) y necesitan hablar su vocabulario.
 */
export function useSystemManifest(systemId: string | null | undefined): ArchetypeManifest {
  const { data } = useSystems();
  return resolveSystemManifest(data?.find((s) => s.id === systemId));
}

export function useCreateSystem() {
  const queryClient = useQueryClient();

  return useMutation<SystemTransport, Error, CreateSystemInput>({
    mutationFn: (data) => api.systems.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systems"] });
    },
  });
}

export function useUpdateSystem() {
  return useOptimisticList<SystemTransport, Error, { systemId: string; data: UpdateSystemInput }, SystemWithSignalsTransport>({
    mutationFn: ({ systemId, data }) => api.systems.update({ id: systemId, ...data }),
    queryKey: ["systems"],
    updater: (systems, { systemId, data }) =>
      systems.map((s) => (s.id === systemId ? { ...s, ...data } : s)),
  });
}

export function useDeleteSystem() {
  const queryClient = useQueryClient();

  return useOptimisticList<void, Error, string, SystemWithSignalsTransport>({
    mutationFn: (systemId) => api.systems.remove({ id: systemId }),
    queryKey: ["systems"],
    updater: (systems, systemId) => systems.filter((s) => s.id !== systemId),
    // El helper invalida ['systems']; al borrar el sistema también purgamos sus
    // tasks/pages/folders cacheadas.
    onSettled: (_data, _error, systemId) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.bySystem(systemId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
      queryClient.invalidateQueries({ queryKey: folderKeys.bySystem(systemId) });
    },
  });
}
