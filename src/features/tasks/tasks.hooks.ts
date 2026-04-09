import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task, CreateTaskInput } from "./tasks.types";

export function useTasks(systemId: string, initialData: Task[]) {
  return useQuery<Task[]>({
    queryKey: ["tasks", systemId],
    queryFn: async () => {
      const res = await fetch(`/api/systems/${systemId}/tasks`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    initialData,
    initialDataUpdatedAt: 0,
  });
}

export function useCreateTask(systemId: string) {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, CreateTaskInput>({
    mutationFn: async (data) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to create task");
      }
      return res.json() as Promise<Task>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", systemId] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", systemId] });
    },
  });
}

export function useToggleTask(systemId: string) {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, string>({
    mutationFn: async (taskId) => {
      const res = await fetch(`/api/tasks/${taskId}/toggle`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to toggle task");
      }
      return res.json() as Promise<Task>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", systemId] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", systemId] });
    },
  });
}
