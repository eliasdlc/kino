"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { useOptimisticListMutation } from "@/shared/hooks/useOptimisticListMutation";
import type { CreateSprintInput, UpdateSprintInput } from "./sprints.schemas";
import type { SprintTransport } from "./sprints.types";

export const sprintKeys = {
  bySystem: (systemId: string) => ["sprints", systemId] as const,
};

export function useSprints(systemId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: sprintKeys.bySystem(systemId),
    queryFn: () => api.sprints.bySystem({ systemId }),
    refetchOnWindowFocus: true,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateSprint(systemId: string) {
  return useOptimisticListMutation<
    SprintTransport,
    Error,
    Omit<CreateSprintInput, "systemId">,
    SprintTransport
  >({
    mutationFn: (data) => api.sprints.create({ ...data, systemId }),
    queryKey: sprintKeys.bySystem(systemId),
    // El placeholder tiene los mismos campos que la lista, ni uno más: si
    // llevara la fila entera, al confirmarse el sprint cambiaría de forma.
    updater: (sprints, data) => [
      ...sprints,
      {
        id: crypto.randomUUID(),
        systemId,
        name: data.name,
        goal: data.goal ?? null,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        status: "active",
        completedAt: null,
        sortOrder: 0,
      },
    ],
  });
}

export function useUpdateSprint(systemId: string) {
  return useOptimisticListMutation<
    SprintTransport,
    Error,
    { sprintId: string; data: UpdateSprintInput },
    SprintTransport
  >({
    mutationFn: ({ sprintId, data }) => api.sprints.update({ id: sprintId, ...data }),
    queryKey: sprintKeys.bySystem(systemId),
    updater: (sprints, { sprintId, data }) =>
      sprints.map((s) => (s.id === sprintId ? { ...s, ...data } : s)),
  });
}

export function useCloseSprint(systemId: string) {
  const qc = useQueryClient();
  return useOptimisticListMutation<SprintTransport, Error, string, SprintTransport>({
    mutationFn: (sprintId) => api.sprints.close({ id: sprintId }),
    queryKey: sprintKeys.bySystem(systemId),
    updater: (sprints, sprintId) =>
      sprints.map((s) =>
        s.id === sprintId
          ? { ...s, status: "completed", completedAt: new Date().toISOString() }
          : s,
      ),
    // cerrar un sprint reordena/refresca tareas asociadas.
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteSprint(systemId: string) {
  const qc = useQueryClient();
  return useOptimisticListMutation<void, Error, string, SprintTransport>({
    mutationFn: (sprintId) => api.sprints.remove({ id: sprintId }),
    queryKey: sprintKeys.bySystem(systemId),
    updater: (sprints, sprintId) => sprints.filter((s) => s.id !== sprintId),
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
