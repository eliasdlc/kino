"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type Task, type CreateTaskInput } from "./tasks.types";
import { useOptimisticListMutation } from "@/shared/hooks/useOptimisticListMutation";
import { deriveStatusFromDate } from "./tasks.utils";
import { taskKeys, allTasksKey } from "./tasks.keys";

/**
 * Mutaciones de una tarea: crear, editar, completar, borrar y restaurar.
 *
 * Extraído de tasks.hooks.ts en KIN-146 (FE-05). Traslado literal: el
 * comportamiento no cambia. `tasks.hooks.ts` sigue reexportando todo, así que
 * ningún consumidor tuvo que cambiar de import.
 */
interface ToggleTaskResult {
  status: string;
}


// Caso multi-key: toca `bySystem` y `folderTasks` a la vez, así que mantiene el
// patrón optimista inline (ver `useOptimisticListMutation` para el caso de una
// sola lista y la doc del patrón canónico).
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
      // Always cancel bySystem — all 4 view components subscribe to this key
      const systemQKey = taskKeys.bySystem(systemId);
      await queryClient.cancelQueries({ queryKey: systemQKey });
      const previousSystem = queryClient.getQueryData<Task[]>(systemQKey);

      // If a folder is involved, also cancel folderTasks to prevent race overwrites
      const folderQKey = folderId ? taskKeys.folderTasks(systemId, folderId) : null;
      if (folderQKey) await queryClient.cancelQueries({ queryKey: folderQKey });
      const previousFolder = folderQKey ? queryClient.getQueryData<Task[]>(folderQKey) : undefined;

      // Status optimista: reusa el único helper del backend (FE-03) en vez de
      // reimplementar la derivación. La tz del navegador refleja lo que el
      // usuario ve; el servidor recalcula con la tz de la cuenta al confirmar.
      const optimisticStatus = deriveStatusFromDate(
        data.startDate,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );

      // Create an optimistic task
      const optimisticTask: Task = {
        id: crypto.randomUUID(),
        title: data.title,
        description: data.description ?? null,
        status: optimisticStatus,
        boardStatus: null,
        boardStatusChangedAt: null,
        priority: (data.priority as Task["priority"]) ?? "medium",
        energyLevel: (data.energyLevel as Task["energyLevel"]) ?? "medium",
        taskType: (data.taskType as Task["taskType"]) ?? null,
        dueDate: data.dueDate ?? null,
        startDate: data.startDate ?? null,
        estimatedTime: data.estimatedTime ?? null,
        parentTaskId: data.parentTaskId ?? null,
        contextTagId: data.contextTagId ?? null,
        folderId: data.folderId ?? null,
        sprintId: null,
        systemId,
        userId: "optimistic",
        recurrenceRule: data.recurrenceRule ?? null,
        recurrenceParentId: null,
        externalSource: null,
        externalId: null,
        sortIndex: 0,
        metadata: null,
        inTodayPlan: false,
        notifiedBeforeDay: false,
        notifiedDueDay: false,
        reminderCount: 0,
        lastRemindedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        deletedAt: null,
      };

      // Write to bySystem so all views immediately see the new task
      queryClient.setQueryData<Task[]>(systemQKey, (old = []) => [...old, optimisticTask]);
      // Also write to folderTasks for consistency in folder-scoped views
      if (folderQKey) {
        queryClient.setQueryData<Task[]>(folderQKey, (old = []) => [...old, optimisticTask]);
      }

      return { previousSystem, systemQKey, previousFolder, folderQKey };
    },
    onSuccess: (newTask) => {
      // Replace the optimistic placeholder (userId="optimistic") with the real task
      queryClient.setQueryData<Task[]>(taskKeys.bySystem(systemId), (old = []) => {
        const withoutOptimistic = old.filter((t) => t.userId !== "optimistic");
        return [...withoutOptimistic, newTask];
      });

      // Mensaje neutro con el destino real (sirve desde QuickAdd global o desde
      // un sistema): no asume que haya un "Action tab" en pantalla.
      const statusLabel: Record<string, string> = {
        today: "Hoy",
        tomorrow: "Mañana",
        week: "Esta semana",
        backlog: "Backlog",
        done: "Completadas",
        archived: "Archivadas",
      };
      const where = statusLabel[newTask.status] ?? "tu lista";
      toast.success(`"${newTask.title}" creada · ${where}`);
    },
    onError: (err, _vars, context) => {
      const ctx = context as {
        previousSystem?: Task[]; systemQKey?: readonly unknown[];
        previousFolder?: Task[]; folderQKey?: readonly unknown[] | null;
      } | undefined;
      if (ctx?.previousSystem !== undefined && ctx?.systemQKey) {
        queryClient.setQueryData(ctx.systemQKey, ctx.previousSystem);
      }
      if (ctx?.previousFolder !== undefined && ctx?.folderQKey) {
        queryClient.setQueryData(ctx.folderQKey, ctx.previousFolder);
      }
      toast.error(err.message ?? "No se pudo crear la tarea");
    },
    onSettled: () => {
      // Invalidating bySystem also covers folderTasks via TanStack Query prefix matching
      queryClient.invalidateQueries({ queryKey: taskKeys.bySystem(systemId) });
    },
  });
}


export function useToggleTask(systemId: string, folderId?: string) {
  return useOptimisticListMutation<ToggleTaskResult, Error, string, Task>({
    mutationFn: async (taskId) => {
      const res = await fetch(`/api/tasks/${taskId}/toggle`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to toggle task");
      }
      return res.json() as Promise<ToggleTaskResult>;
    },
    queryKey: folderId ? taskKeys.folderTasks(systemId, folderId) : taskKeys.bySystem(systemId),
    updater: (tasks, taskId) =>
      tasks.map((t) => (t.id === taskId ? { ...t, status: t.status === "done" ? "today" : "done" } : t)),
    // Invalida el prefijo completo ['tasks'] → system, folder, today-plan y all
    // refetchan, dejando consistentes las tres vistas tras completar.
    invalidateKey: ["tasks"],
    onError: (err) => toast.error(err.message ?? "No se pudo actualizar la tarea"),
  });
}


export function useDeleteTask(systemId: string, folderId?: string) {
  return useOptimisticListMutation<void, Error, string, Task>({
    mutationFn: async (taskId) => {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    queryKey: folderId ? taskKeys.folderTasks(systemId, folderId) : taskKeys.bySystem(systemId),
    updater: (tasks, taskId) => tasks.filter((t) => t.id !== taskId),
    // bySystem es prefijo de folderTasks → invalidarla cubre ambas vistas.
    invalidateKey: taskKeys.bySystem(systemId),
  });
}


export function useDeleteTaskWithUndo(systemId: string, folderId?: string) {
  const queryClient = useQueryClient();

  const { mutate: restore } = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to restore task");
      return res.json() as Promise<Task>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.bySystem(systemId) });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.folderTasks(systemId, folderId) });
      }
    },
  });

  return useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    onMutate: async (taskId) => {
      const qKey = folderId ? taskKeys.folderTasks(systemId, folderId) : taskKeys.bySystem(systemId);
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Task[]>(qKey);
      const deletedTask = previous?.find((t) => t.id === taskId);
      queryClient.setQueryData<Task[]>(qKey, (old = []) => old.filter((t) => t.id !== taskId));
      return { previous, qKey, deletedTask };
    },
    onSuccess: (_data, taskId, context) => {
      const title = context?.deletedTask?.title ?? "Tarea";
      toast(`"${title}" movida a la papelera`, {
        action: {
          label: "Deshacer",
          onClick: () => restore(taskId),
        },
        duration: 5000,
      });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.qKey, context.previous);
      }
      toast.error("No se pudo mover a la papelera");
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


/**
 * Borrado con undo no ligado a un sistema — para la vista global /tasks, donde
 * cada tarea tiene su propio systemId. Optimista sobre la lista global e
 * invalida todo el prefijo ['tasks'] al asentar.
 */
export function useDeleteAnyTaskWithUndo() {
  const queryClient = useQueryClient();

  const { mutate: restore } = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to restore task");
      return res.json() as Promise<Task>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return useMutation<void, Error, string, { previous?: Task[]; deletedTask?: Task }>({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
    },
    onMutate: async (taskId) => {
      const qKey = allTasksKey();
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<Task[]>(qKey);
      const deletedTask = previous?.find((t) => t.id === taskId);
      queryClient.setQueryData<Task[]>(qKey, (old = []) => old.filter((t) => t.id !== taskId));
      return { previous, deletedTask };
    },
    onSuccess: (_data, taskId, context) => {
      const title = context?.deletedTask?.title ?? "Tarea";
      toast(`"${title}" movida a la papelera`, {
        action: { label: "Deshacer", onClick: () => restore(taskId) },
        duration: 5000,
      });
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(allTasksKey(), context.previous);
      toast.error("No se pudo borrar la tarea");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}


export function useRestoreTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, string>({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to restore task");
      return res.json() as Promise<Task>;
    },
    onSuccess: (task) => {
      toast.success(`"${task.title}" restaurada`);
      // Refresca papelera y todas las vistas de tareas.
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => toast.error("No se pudo restaurar la tarea"),
  });
}


export function useUpdateTask(systemId: string) {
  const queryClient = useQueryClient();

  return useOptimisticListMutation<
    Task,
    Error,
    { taskId: string; data: Partial<Omit<Task, "id" | "userId" | "systemId" | "createdAt" | "updatedAt" | "deletedAt">> },
    Task
  >({
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
    queryKey: taskKeys.bySystem(systemId),
    updater: (tasks, { taskId, data }) =>
      tasks.map((t) => (t.id === taskId ? { ...t, ...data } : t)),
    onSettled: () => {
      // Invalidate linked tasks so any panel showing this task updates
      // (la invalidación de bySystem la hace el helper por defecto).
      queryClient.invalidateQueries({ queryKey: ["pages", "tasks"] });
    },
  });
}


/** Mueve una tarjeta de columna del board (systemType `project`). Optimista:
 * refleja la nueva columna y, si entra/sale de la terminal, el done de scheduling. */
export function useMoveTaskBoard(systemId: string) {
  return useOptimisticListMutation<Task, Error, { taskId: string; boardStatus: string }, Task>({
    mutationFn: async ({ taskId, boardStatus }) => {
      const res = await fetch(`/api/tasks/${taskId}/board`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to move task");
      }
      return res.json() as Promise<Task>;
    },
    queryKey: taskKeys.bySystem(systemId),
    updater: (tasks, { taskId, boardStatus }) =>
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        const enteringDone = boardStatus === "done" && t.status !== "done";
        const leavingDone = boardStatus !== "done" && t.boardStatus === "done" && t.status === "done";
        return {
          ...t,
          boardStatus,
          boardStatusChangedAt: new Date(),
          ...(enteringDone ? { status: "done", completedAt: new Date() } : {}),
          ...(leavingDone ? { status: "today", completedAt: null } : {}),
        } as Task;
      }),
    invalidateKey: ["tasks"],
  });
}

// ── Today plan hooks ──────────────────────────────────────────────────────────


export function useUpdateCalendarTask(from: string, to: string) {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, { taskId: string; data: Partial<Task> }>({
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
      const calKey = taskKeys.calendarTasks(from, to);
      await queryClient.cancelQueries({ queryKey: calKey });
      await queryClient.cancelQueries({ queryKey: allTasksKey() });

      const previousCal = queryClient.getQueryData<Task[]>(calKey);
      const previousAll = queryClient.getQueryData<Task[]>(allTasksKey());

      queryClient.setQueryData<Task[]>(calKey, (old = []) => {
        const exists = old.some((t) => t.id === taskId);
        if (exists) return old.map((t) => (t.id === taskId ? { ...t, ...data } : t));
        // Adding a previously unscheduled task — pull from allTasks cache
        const allTasks = queryClient.getQueryData<Task[]>(allTasksKey()) ?? [];
        const task = allTasks.find((t) => t.id === taskId);
        if (task) return [...old, { ...task, ...data }];
        return old;
      });
      queryClient.setQueryData<Task[]>(allTasksKey(), (old = []) =>
        old.map((t) => (t.id === taskId ? { ...t, ...data } : t)),
      );

      return { previousCal, previousAll };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previousCal?: Task[]; previousAll?: Task[] } | undefined;
      if (ctx?.previousCal !== undefined) queryClient.setQueryData(taskKeys.calendarTasks(from, to), ctx.previousCal);
      if (ctx?.previousAll !== undefined) queryClient.setQueryData(allTasksKey(), ctx.previousAll);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "calendar"] });
      queryClient.invalidateQueries({ queryKey: allTasksKey() });
    },
  });
}

