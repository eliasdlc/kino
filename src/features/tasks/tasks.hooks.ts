import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Task, CreateTaskInput } from "./tasks.types";
import { computeEnergyBudget, mergeCommitted } from "@/features/energy/energy.budget";
import { userSettingsKey } from "@/features/settings/settings.hooks";
import type { AdvisorBulkAction } from "@/features/energy/energy.service";
import { useOptimisticListMutation } from "@/shared/hooks/useOptimisticListMutation";
import { deriveStatusFromDate } from "./tasks.utils";

// Re-export query keys from the shared module (no React deps) so existing
// consumers that `import { taskKeys } from './tasks.hooks'` keep working.
export { taskKeys, allTasksKey, suggestedTasksKey, reminderKeys } from "./tasks.keys";
import { taskKeys, allTasksKey, suggestedTasksKey, reminderKeys } from "./tasks.keys";

interface ToggleTaskResult {
  status: string;
}

/** Tareas en la papelera (deleted_at IS NOT NULL) de un sistema. */
export function useTrashedTasks(systemId: string, enabled = true) {
  return useQuery<Task[]>({
    queryKey: taskKeys.trash(systemId),
    queryFn: async () => {
      const res = await fetch(`/api/tasks?systemId=${systemId}&deleted=true`);
      if (!res.ok) throw new Error("Failed to fetch trashed tasks");
      return res.json();
    },
    enabled,
  });
}

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
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

export function useFolderTasks(systemId: string, folderId: string, initialData?: Task[]) {
  return useQuery<Task[]>({
    queryKey: taskKeys.folderTasks(systemId, folderId),
    queryFn: async () => {
      const res = await fetch(`/api/systems/${systemId}/folders/${folderId}/tasks`);
      if (!res.ok) throw new Error("Failed to fetch folder tasks");
      return res.json();
    },
    enabled: !!folderId,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    ...(initialData !== undefined ? { initialData, initialDataUpdatedAt: 0 } : {}),
  });
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
    refetchOnWindowFocus: true,
    staleTime: 30_000,
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

export function useAdvisorAction() {
  const router = useRouter();

  return useMutation<void, Error, { taskIds: string[]; bulkAction: AdvisorBulkAction; actionLabel: string }>({
    mutationFn: async ({ taskIds, bulkAction }) => {
      if (bulkAction === 'none' || taskIds.length === 0) return;

      if (bulkAction === 'move-tomorrow') {
        const res = await fetch('/api/tasks/bulk-move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds, status: 'tomorrow' }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'No se pudo mover las tareas');
        }
      } else if (bulkAction === 'move-today') {
        const res = await fetch('/api/tasks/bulk-move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds, status: 'today' }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'No se pudo mover la tarea');
        }
      } else if (bulkAction === 'lower-priority') {
        const res = await fetch('/api/tasks/bulk-update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskIds, priority: 'high' }),
        });
        if (!res.ok) throw new Error('No se pudo actualizar la prioridad');
      }
    },
    onSuccess: (_data, { actionLabel }) => {
      toast.success(actionLabel);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message ?? 'Error al ejecutar la acción');
    },
  });
}

type BulkMoveCtx = {
  previous: [readonly unknown[], Task[] | undefined][];
  previousStates: { id: string; status: string }[];
};

/**
 * Aviso de sobregiro tras comprometer tareas al día (Fase 4.1 · D2).
 *
 * Se lee del cache —plan de hoy + límite de ajustes— en vez de pedirlo al server:
 * este es justo el camino que antes devolvía 422 por energía, y ahora tiene que
 * informar sin frenar. Solo cuenta las tareas que aún no estaban en el plan, para
 * no inflar el presupuesto al re-mover algo que ya estaba comprometido.
 *
 * Devuelve undefined si no hay sobregiro (o falta el límite): sin ruido innecesario.
 */
function overdraftNotice(queryClient: QueryClient, taskIds: string[]): string | undefined {
  const limit = queryClient.getQueryData<{ dailyEnergyLimit: number }>(userSettingsKey())
    ?.dailyEnergyLimit;
  if (!limit) return undefined;

  const planTasks = queryClient.getQueryData<Task[]>(taskKeys.todayPlan()) ?? [];
  const allTasks = queryClient.getQueryData<Task[]>(allTasksKey()) ?? [];
  const committed = taskIds
    .map((id) => allTasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);

  const budget = computeEnergyBudget(mergeCommitted(planTasks, committed), limit);
  if (budget.state !== 'over') return undefined;

  return `Energía comprometida: ${budget.committed}/${budget.limit} pts (+${budget.overBy}). Nada bloqueado — solo que lo sepas.`;
}

export function useBulkMove() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { taskIds: string[]; status: string }, BulkMoveCtx>({
    mutationFn: async ({ taskIds, status }) => {
      const res = await fetch('/api/tasks/bulk-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, status }),
      });
      if (!res.ok) throw new Error('No se pudo mover las tareas');
    },
    onMutate: async ({ taskIds, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] });
      const allTasks = queryClient.getQueryData<Task[]>(allTasksKey()) ?? [];
      const previousStates = taskIds.map((id) => ({
        id,
        status: allTasks.find((t) => t.id === id)?.status ?? 'backlog',
      }));
      queryClient.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (old) =>
        old?.map((t) => (taskIds.includes(t.id) ? { ...t, status } : t))
      );
      return { previous, previousStates };
    },
    onSuccess: (_data, { taskIds, status }, context) => {
      const n = taskIds.length;
      const { previousStates } = context;
      toast.success(`${n} tarea${n !== 1 ? 's' : ''} movida${n !== 1 ? 's' : ''}`, {
        description: status === 'today' ? overdraftNotice(queryClient, taskIds) : undefined,
        duration: 7000,
        action: {
          label: 'Deshacer',
          onClick: async () => {
            await Promise.all(
              previousStates.map(({ id, status }) =>
                fetch(`/api/tasks/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status }),
                })
              )
            );
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
          },
        },
      });
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error('No se pudo mover las tareas');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

type BulkUpdateCtx = {
  previous: [readonly unknown[], Task[] | undefined][];
  previousStates: { id: string; priority: string | null }[];
};

export function useBulkUpdate() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { taskIds: string[]; priority: string }, BulkUpdateCtx>({
    mutationFn: async ({ taskIds, priority }) => {
      const res = await fetch('/api/tasks/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, priority }),
      });
      if (!res.ok) throw new Error('No se pudo actualizar la prioridad');
    },
    onMutate: async ({ taskIds, priority }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] });
      const allTasks = queryClient.getQueryData<Task[]>(allTasksKey()) ?? [];
      const previousStates = taskIds.map((id) => ({
        id,
        priority: allTasks.find((t) => t.id === id)?.priority ?? null,
      }));
      queryClient.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (old) =>
        old?.map((t) => (taskIds.includes(t.id) ? { ...t, priority: priority as Task['priority'] } : t))
      );
      return { previous, previousStates };
    },
    onSuccess: (_data, _vars, context) => {
      const { previousStates } = context;
      toast.success('Prioridad actualizada', {
        duration: 7000,
        action: {
          label: 'Deshacer',
          onClick: async () => {
            await Promise.all(
              previousStates
                .filter(({ priority }) => priority !== null)
                .map(({ id, priority }) =>
                  fetch(`/api/tasks/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ priority }),
                  })
                )
            );
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
          },
        },
      });
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error('No se pudo actualizar la prioridad');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export interface TaskReminder {
  id: string;
  taskId: string;
  userId: string;
  remindAt: string;
  sentAt: string | null;
  label: string | null;
  source: 'auto' | 'user';
  createdAt: string;
}



export function useTaskReminders(taskId: string) {
  return useQuery<TaskReminder[]>({
    queryKey: reminderKeys.byTask(taskId),
    queryFn: async () => {
      const res = await fetch(`/api/push/reminders?taskId=${taskId}`);
      if (!res.ok) throw new Error('Failed to fetch reminders');
      return res.json() as Promise<TaskReminder[]>;
    },
    staleTime: 30_000,
  });
}

export function useCreateTaskReminder(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { remindAt: string; label?: string }) => {
      const res = await fetch('/api/push/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, ...data }),
      });
      if (!res.ok) throw new Error('Failed to create reminder');
      return res.json() as Promise<TaskReminder>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.byTask(taskId) });
    },
    onError: () => {
      toast.error('Error al crear el recordatorio');
    },
  });
}

export function useDeleteTaskReminder(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reminderId: string) => {
      const res = await fetch(`/api/push/reminders/${reminderId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete reminder');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reminderKeys.byTask(taskId) });
    },
    onError: () => {
      toast.error('Error al eliminar el recordatorio');
    },
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

export function useTodayPlanTasks() {
  return useQuery<Task[]>({
    queryKey: taskKeys.todayPlan(),
    queryFn: async () => {
      const res = await fetch('/api/tasks/today-plan');
      if (!res.ok) throw new Error('Failed to fetch today plan');
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useToggleTodayTask() {
  const queryClient = useQueryClient();
  return useMutation<{ status: string }, Error, { taskId: string }>({
    mutationFn: async ({ taskId }) => {
      const res = await fetch(`/api/tasks/${taskId}/toggle`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to toggle task');
      return res.json();
    },
    // Optimista sobre TODAS las queries de tareas (today-plan, all, system…) por
    // prefijo, para que la vista visible reaccione sin importar de cuál lea.
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] });
      queryClient.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (old) =>
        old?.map((t) =>
          t.id === taskId
            ? { ...t, status: t.status === 'done' ? 'today' : 'done', completedAt: t.status === 'done' ? null : new Date() }
            : t,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      const c = ctx as { previous?: [readonly unknown[], Task[] | undefined][] } | undefined;
      c?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error('No se pudo guardar. Intenta de nuevo.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useMoveToTomorrow() {
  return useOptimisticListMutation<unknown, Error, { taskId: string; tomorrow: string }, Task>({
    mutationFn: async ({ taskId, tomorrow }) => {
      // Mover en la PROGRAMACIÓN (startDate), no en la fecha límite. El service
      // deriva status 'tomorrow' desde startDate; inTodayPlan explícito lo saca
      // del plan de hoy. Nunca tocamos dueDate (es el deadline del usuario).
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: tomorrow, inTodayPlan: false }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Error al procesar la solicitud');
      }
      return res.json();
    },
    queryKey: taskKeys.todayPlan(),
    updater: (tasks, { taskId }) => tasks.filter((t) => t.id !== taskId),
    onError: () => toast.error('No se pudo mover. Intenta de nuevo.'),
  });
}

export function useAddToTodayPlan() {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, { taskId: string }>({
    mutationFn: async ({ taskId }) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inTodayPlan: true }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.todayPlan() });
      const previous = queryClient.getQueryData<Task[]>(taskKeys.todayPlan());
      return { previous, taskId };
    },
    onError: (_err, _vars, ctx) => {
      const c = ctx as { previous?: Task[] } | undefined;
      if (c?.previous) queryClient.setQueryData(taskKeys.todayPlan(), c.previous);
      toast.error('No se pudo agregar al plan.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.todayPlan() });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] });
    },
  });
}

export function useRemoveFromPlan() {
  return useOptimisticListMutation<unknown, Error, { taskId: string }, Task>({
    mutationFn: async ({ taskId }) => {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inTodayPlan: false }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    queryKey: taskKeys.todayPlan(),
    updater: (tasks, { taskId }) => tasks.filter((t) => t.id !== taskId),
    onError: () => toast.error('No se pudo quitar del plan. Intenta de nuevo.'),
  });
}

// ── Fase 2: tareas globales y sugeridas ──────────────────────────────────



export function useAllTasks() {
  return useQuery<Task[]>({
    queryKey: allTasksKey(),
    queryFn: async () => {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json() as Promise<Task[]>;
    },
    staleTime: 30_000,
  });
}

export type SuggestedTask = Task & { importanceScore: number; why: string; energyBand: string };



export function useSuggestedTasks() {
  return useQuery<SuggestedTask[]>({
    queryKey: suggestedTasksKey(),
    queryFn: async () => {
      const res = await fetch('/api/insights/suggest?limit=10');
      if (!res.ok) throw new Error('Failed to fetch suggestions');
      return res.json() as Promise<SuggestedTask[]>;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

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

export function useCalendarTasks(from: string, to: string) {
  return useQuery<Task[]>({
    queryKey: taskKeys.calendarTasks(from, to),
    queryFn: async () => {
      const res = await fetch(`/api/tasks/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (!res.ok) throw new Error('Failed to fetch calendar tasks');
      return res.json() as Promise<Task[]>;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
