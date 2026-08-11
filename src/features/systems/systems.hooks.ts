import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimisticListMutation } from "@/shared/hooks/useOptimisticListMutation";
import type { System, SystemWithSignals, CreateSystemInput, UpdateSystemInput } from "./systems.types";
import { folderKeys } from "@/features/folders/folders.hooks";
import { pageKeys } from "@/features/pages/pages.hooks";
import { taskKeys } from "@/features/tasks/tasks.hooks";
import { resolveSystemManifest } from "@/shared/lib/system-manifest";
import type { ArchetypeManifest } from "@/shared/lib/system-types";

export function useSystems() {
  return useQuery<SystemWithSignals[]>({
    queryKey: ["systems"],
    queryFn: async () => {
      const res = await fetch("/api/systems");
      if (!res.ok) throw new Error("Failed to fetch systems");
      return res.json();
    },
    refetchOnWindowFocus: true,
  });
}

/**
 * La versión viva de un sistema que llegó como prop de un server component.
 * Las vistas de detalle reciben la fila renderizada en el servidor y no se
 * re-renderizan al mutar; la lista `["systems"]` sí (mutación optimista), así
 * que componer un sistema se ve al instante en vez de al navegar.
 */
export function useLiveSystem<T extends System>(system: T): T {
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

  return useMutation<System, Error, CreateSystemInput>({
    mutationFn: async (data) => {
      const res = await fetch("/api/systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to create system");
      }
      return res.json() as Promise<System>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systems"] });
    },
  });
}

export function useUpdateSystem() {
  return useOptimisticListMutation<System, Error, { systemId: string; data: UpdateSystemInput }, SystemWithSignals>({
    mutationFn: async ({ systemId, data }) => {
      const res = await fetch(`/api/systems/${systemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to update system");
      }
      return res.json() as Promise<System>;
    },
    queryKey: ["systems"],
    updater: (systems, { systemId, data }) =>
      systems.map((s) => (s.id === systemId ? { ...s, ...data } : s)),
  });
}

export function useDeleteSystem() {
  const queryClient = useQueryClient();

  return useOptimisticListMutation<void, Error, string, SystemWithSignals>({
    mutationFn: async (systemId) => {
      const res = await fetch(`/api/systems/${systemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete system");
    },
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
