import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Task, CreateTaskInput } from "./tasks.types";

interface ToggleTaskResult {
  status: string;
  xp_earned?: number;
}

export const taskKeys = {
  bySystem: (systemId: string) => ["tasks", "system", systemId] as const,
  subtasks: (taskId: string) => ["tasks", "subtasks", taskId] as const,
  folderTasks: (systemId: string, folderId: string) => ["tasks", "system", systemId, "folder", folderId] as const,
};

export function useTasks(systemId: string, initialData: Task[]) {
  return useQuery<Task[]>({
    queryKey: taskKeys.bySystem(systemId),
    queryFn: async () => {
      const res = await fetch(`/api/systems/${systemId}/tasks`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
    initialData,
    initialDataUpdatedAt: 0,
  });
}

export function useFolderTasks(systemId: string, folderId: string) {
  return useQuery<Task[]>({
    queryKey: taskKeys.folderTasks(systemId, folderId),
    queryFn: async () => {
      const res = await fetch(`/api/systems/${systemId}/folders/${folderId}/tasks`);
      if (!res.ok) throw new Error("Failed to fetch folder tasks");
      return res.json();
    },
    enabled: !!folderId,
  });
}

export function useCreateTask(systemId: string, folderId?: string) {
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
    onMutate: async (data) => {
      const qKey = folderId ? taskKeys.folderTasks(systemId, folderId) : taskKeys.bySystem(systemId);
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Task[]>(qKey);

      // Derive optimistic status from startDate (mirrors backend logic)
      const optimisticStatus = (() => {
        if (!data.startDate) return "backlog" as const;
        const d = new Date(data.startDate + "T00:00:00");
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (d.getTime() === today.getTime()) return "today" as const;
        if (d.getTime() === tomorrow.getTime()) return "tomorrow" as const;
        return "week" as const;
      })();

      // Create an optimistic task
      const optimisticTask: Task = {
        id: crypto.randomUUID(),
        title: data.title,
        description: data.description ?? null,
        status: optimisticStatus,
        priority: (data.priority as Task["priority"]) ?? "medium",
        energyLevel: (data.energyLevel as Task["energyLevel"]) ?? "medium",
        taskType: (data.taskType as Task["taskType"]) ?? null,
        dueDate: data.dueDate ?? null,
        startDate: data.startDate ?? null,
        estimatedTime: data.estimatedTime ?? null,
        parentTaskId: data.parentTaskId ?? null,
        contextTagId: data.contextTagId ?? null,
        folderId: data.folderId ?? null,
        systemId,
        userId: "optimistic",
        recurrenceRule: null,
        recurrenceParentId: null,
        externalSource: null,
        sortIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        deletedAt: null,
      };

      queryClient.setQueryData<Task[]>(qKey, (old = []) => [...old, optimisticTask]);
      return { previous, qKey };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: Task[], qKey?: readonly unknown[] } | undefined;
      if (ctx?.previous && ctx?.qKey) {
        queryClient.setQueryData(ctx.qKey, ctx.previous);
      }
    },
    onSettled: (_data, _error, _vars, context) => {
      const ctx = context as { qKey?: readonly unknown[] } | undefined;
      if (ctx?.qKey) {
        queryClient.invalidateQueries({ queryKey: ctx.qKey });
      }
      queryClient.invalidateQueries({ queryKey: taskKeys.bySystem(systemId) });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.folderTasks(systemId, folderId) });
      }
    },
  });
}

export function useToggleTask(systemId: string, folderId?: string) {
  const queryClient = useQueryClient();

  return useMutation<ToggleTaskResult, Error, string>({
    mutationFn: async (taskId) => {
      const res = await fetch(`/api/tasks/${taskId}/toggle`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to toggle task");
      }
      return res.json() as Promise<ToggleTaskResult>;
    },
    onMutate: async (taskId) => {
      const qKey = folderId ? taskKeys.folderTasks(systemId, folderId) : taskKeys.bySystem(systemId);
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Task[]>(qKey);
      queryClient.setQueryData<Task[]>(qKey, (old = []) => 
        old.map((t) => t.id === taskId ? { ...t, status: t.status === "done" ? "today" : "done" } : t)
      );
      return { previous, qKey };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: Task[], qKey?: readonly unknown[] } | undefined;
      if (ctx?.previous && ctx?.qKey) {
        queryClient.setQueryData(ctx.qKey, ctx.previous);
      }
    },
    onSettled: (_data, _error, _vars, context) => {
      const ctx = context as { qKey?: readonly unknown[] } | undefined;
      if (ctx?.qKey) {
        queryClient.invalidateQueries({ queryKey: ctx.qKey });
      }
      queryClient.invalidateQueries({ queryKey: taskKeys.bySystem(systemId) });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.folderTasks(systemId, folderId) });
      }
    },
  });
}

export function useSubtasks(
  taskId: string,
  _systemId: string,
  options?: { enabled?: boolean }
) {
  return useQuery<Task[]>({
    queryKey: taskKeys.subtasks(taskId),
    queryFn: async () => {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`);
      if (!res.ok) throw new Error("Failed to fetch subtasks");
      return res.json();
    },
    enabled: options?.enabled ?? true,
  });
}

export function useDeleteTask(systemId: string, folderId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    onMutate: async (taskId) => {
      const qKey = folderId ? taskKeys.folderTasks(systemId, folderId) : taskKeys.bySystem(systemId);
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Task[]>(qKey);
      queryClient.setQueryData<Task[]>(qKey, (old = []) => 
        old.filter((t) => t.id !== taskId)
      );
      return { previous, qKey };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.qKey, context.previous);
      }
    },
    onSettled: (_data, _error, _vars, context) => {
      if (context?.qKey) {
        queryClient.invalidateQueries({ queryKey: context.qKey });
      }
      queryClient.invalidateQueries({ queryKey: taskKeys.bySystem(systemId) });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.folderTasks(systemId, folderId) });
      }
    },
  });
}

export function useUpdateTask(systemId: string) {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, { taskId: string; data: Partial<Omit<Task, "id" | "userId" | "systemId" | "createdAt" | "updatedAt" | "deletedAt">> }>({
    mutationFn: async ({ taskId, data }) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to update task");
      }
      return res.json() as Promise<Task>;
    },
    onMutate: async ({ taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.bySystem(systemId) });
      const previous = queryClient.getQueryData<Task[]>(taskKeys.bySystem(systemId));
      queryClient.setQueryData<Task[]>(taskKeys.bySystem(systemId), (old = []) =>
        old.map((t) => (t.id === taskId ? { ...t, ...data } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: Task[] } | undefined;
      if (ctx?.previous) {
        queryClient.setQueryData(taskKeys.bySystem(systemId), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.bySystem(systemId) });
      // Invalidate linked tasks so any panel showing this task updates
      queryClient.invalidateQueries({ queryKey: ["pages", "tasks"] });
    },
  });
}
