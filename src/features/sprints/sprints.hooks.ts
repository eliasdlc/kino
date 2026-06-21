"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimisticListMutation } from "@/shared/hooks/useOptimisticListMutation";
import type { CreateSprintInput, UpdateSprintInput } from "./sprints.schemas";
import type { Sprint } from "./sprints.types";

export const sprintKeys = {
  bySystem: (systemId: string) => ["sprints", systemId] as const,
};

export function useSprints(systemId: string, options?: { enabled?: boolean }) {
  return useQuery<Sprint[]>({
    queryKey: sprintKeys.bySystem(systemId),
    queryFn: async () => {
      const res = await fetch(`/api/systems/${systemId}/sprints`);
      if (!res.ok) throw new Error("Failed to fetch sprints");
      return res.json();
    },
    refetchOnWindowFocus: true,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateSprint(systemId: string) {
  return useOptimisticListMutation<Sprint, Error, Omit<CreateSprintInput, "systemId">, Sprint>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/systems/${systemId}/sprints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Failed to create sprint");
      }
      return res.json();
    },
    queryKey: sprintKeys.bySystem(systemId),
    updater: (sprints, data) => [
      ...sprints,
      {
        id: crypto.randomUUID(),
        userId: "optimistic",
        systemId,
        name: data.name,
        goal: data.goal ?? null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: "active",
        completedAt: null,
        sortOrder: 0,
        externalId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });
}

export function useUpdateSprint(systemId: string) {
  return useOptimisticListMutation<Sprint, Error, { sprintId: string; data: UpdateSprintInput }, Sprint>({
    mutationFn: async ({ sprintId, data }) => {
      const res = await fetch(`/api/sprints/${sprintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update sprint");
      return res.json();
    },
    queryKey: sprintKeys.bySystem(systemId),
    updater: (sprints, { sprintId, data }) =>
      sprints.map((s) =>
        s.id === sprintId
          ? {
              ...s,
              ...data,
              startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : s.startDate,
              endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : s.endDate,
            }
          : s,
      ),
  });
}

export function useCloseSprint(systemId: string) {
  const qc = useQueryClient();
  return useOptimisticListMutation<Sprint, Error, string, Sprint>({
    mutationFn: async (sprintId) => {
      const res = await fetch(`/api/sprints/${sprintId}/close`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to close sprint");
      return res.json();
    },
    queryKey: sprintKeys.bySystem(systemId),
    updater: (sprints, sprintId) =>
      sprints.map((s) =>
        s.id === sprintId ? { ...s, status: "completed", completedAt: new Date() } : s,
      ),
    // cerrar un sprint reordena/refresca tareas asociadas.
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteSprint(systemId: string) {
  const qc = useQueryClient();
  return useOptimisticListMutation<void, Error, string, Sprint>({
    mutationFn: async (sprintId) => {
      const res = await fetch(`/api/sprints/${sprintId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete sprint");
    },
    queryKey: sprintKeys.bySystem(systemId),
    updater: (sprints, sprintId) => sprints.filter((s) => s.id !== sprintId),
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
