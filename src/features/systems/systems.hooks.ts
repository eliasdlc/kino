import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { System, CreateSystemInput, UpdateSystemInput } from "./systems.types";
import { folderKeys } from "@/features/folders/folders.hooks";
import { pageKeys } from "@/features/pages/pages.hooks";
import { taskKeys } from "@/features/tasks/tasks.hooks";

export function useSystems() {
  return useQuery<System[]>({
    queryKey: ["systems"],
    queryFn: async () => {
      const res = await fetch("/api/systems");
      if (!res.ok) throw new Error("Failed to fetch systems");
      return res.json();
    },
  });
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
  const queryClient = useQueryClient();

  return useMutation<System, Error, { systemId: string; data: UpdateSystemInput }>({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["systems"] });
    },
  });
}

export function useDeleteSystem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (systemId: string) => {
      const res = await fetch(`/api/systems/${systemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete system");
    },
    onSuccess: (_, systemId) => {
      queryClient.invalidateQueries({ queryKey: ["systems"] });
      queryClient.invalidateQueries({ queryKey: taskKeys.bySystem(systemId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
      queryClient.invalidateQueries({ queryKey: folderKeys.bySystem(systemId) });
    },
  });
}
