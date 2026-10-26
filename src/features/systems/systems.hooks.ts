import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import type { SystemTransport, UpdateSystemInput } from "./systems.types";
import { resolveSystemManifest } from "@/shared/lib/system-manifest";
import type { ArchetypeManifest } from "@/shared/lib/system-types";

export function useSystems() {
  return useConvexQuery(api.systems.list, {});
}

/**
 * La versión viva de un sistema que llegó como prop de un server component.
 * Las vistas de detalle reciben la fila renderizada en el servidor y no se
 * re-renderizan al mutar; la lista sí, así que componer un sistema se ve al
 * instante en vez de al navegar.
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

/**
 * El manifiesto para una fila de índice: el que le pasa su lista, o el de la
 * suscripción si nadie se lo dio. Con el manifiesto dado no se suscribe: una
 * fila suscrita a la lista de sistemas se pintaba otra vez cada vez que
 * cambiaba una tarea de cualquier sistema (las señales viajan en esa lista).
 */
export function useRowManifest(systemId: string, given?: ArchetypeManifest): ArchetypeManifest {
  const { data } = useConvexQuery(api.systems.list, given ? "skip" : {});
  return given ?? resolveSystemManifest(data?.find((s) => s.id === systemId));
}

export function useCreateSystem() {
  return useConvexMutation(api.systems.create);
}

export function useUpdateSystem() {
  return useConvexMutation(api.systems.update, {
    map: ({ systemId, data }: { systemId: string; data: UpdateSystemInput }) => ({ id: systemId, ...data }),
  });
}

export function useDeleteSystem() {
  return useConvexMutation(api.systems.remove, { map: (systemId: string) => ({ id: systemId }) });
}
