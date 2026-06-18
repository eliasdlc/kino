"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    refetchInterval: 10_000,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateSprint(systemId: string) {
  const qc = useQueryClient();
  return useMutation<Sprint, Error, Omit<CreateSprintInput, "systemId">>({
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
    onSuccess: () => qc.invalidateQueries({ queryKey: sprintKeys.bySystem(systemId) }),
  });
}

export function useUpdateSprint(systemId: string) {
  const qc = useQueryClient();
  return useMutation<Sprint, Error, { sprintId: string; data: UpdateSprintInput }>({
    mutationFn: async ({ sprintId, data }) => {
      const res = await fetch(`/api/sprints/${sprintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update sprint");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: sprintKeys.bySystem(systemId) }),
  });
}

export function useCloseSprint(systemId: string) {
  const qc = useQueryClient();
  return useMutation<Sprint, Error, string>({
    mutationFn: async (sprintId) => {
      const res = await fetch(`/api/sprints/${sprintId}/close`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to close sprint");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sprintKeys.bySystem(systemId) });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteSprint(systemId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (sprintId) => {
      const res = await fetch(`/api/sprints/${sprintId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete sprint");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sprintKeys.bySystem(systemId) });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
