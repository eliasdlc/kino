"use client";

import { onlineManager, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/api/client";
import { type TaskTransport, type CreateTaskInput, type UpdateTaskInput } from "./tasks.types";
import { useOptimisticListMutation } from "@/shared/hooks/useOptimisticListMutation";
import {
  applyCreated,
  applyOptimistic,
  createTaskSpec,
  revertOptimistic,
} from "@/features/offline/offline.mutations";
import { useStampedMutation } from "@/features/offline/offline.hooks";
import { taskKeys, allTasksKey } from "./tasks.keys";

/**
 * Mutaciones de una tarea: crear, editar, completar, borrar y restaurar.
 *
 * Todas hablan por `api.tasks.*`, así que el cuerpo que mandan y lo que reciben
 * los decide el contrato. Lo que la caché guarda es la forma de transporte, con
 * las fechas en texto: un `new Date()` en un updater optimista dejaría un valor
 * que el siguiente refetch no puede reproducir.
 */
interface ToggleTaskResult {
  status: string;
}


/**
 * Crear tarea — la única mutación que sobrevive a la falta de red (KIN-57).
 *
 * Caso multi-key: toca `bySystem` y `folderTasks` a la vez, así que no usa
 * `useOptimisticListMutation` (pensado para una sola lista). Lo que antes estaba
 * inline aquí —el `mutationFn`, el placeholder optimista y las keys que toca—
 * vive ahora en `createTaskSpec`, porque la cola offline necesita reproducir todo
 * eso **sin este componente montado**, después de cerrar y reabrir el navegador.
 *
 * El rollback ya no restaura un snapshot de la lista entera: retira sólo el
 * placeholder de esta creación. Con varias capturas en vuelo a la vez —justo lo
 * que pasa al vaciar la cola— restaurar el snapshot borraría las otras.
 */
export function useCreateTask(systemId: string, folderId?: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation<TaskTransport, Error, CreateTaskInput>({
    mutationKey: createTaskSpec.mutationKey,
    mutationFn: createTaskSpec.mutationFn,
    // Intenta la petición aunque el navegador se crea sin red, y sólo se pausa
    // cuando falla de verdad. Ver `registerOfflineMutationDefaults`.
    networkMode: "offlineFirst",
    onMutate: async (data) => {
      const keys = [
        ...createTaskSpec.queryKeys(data),
        ...(folderId ? [taskKeys.folderTasks(systemId, folderId)] : []),
      ];
      await Promise.all(
        keys.map((queryKey) => queryClient.cancelQueries({ queryKey })),
      );
      applyOptimistic(queryClient, createTaskSpec, data);

      if (!onlineManager.isOnline()) {
        toast.success(`"${data.title}" guardada sin conexión · se subirá al volver la red`);
      }
    },
    onSuccess: (newTask, data) => {
      applyCreated(queryClient, createTaskSpec, data, newTask);

      // Al reconectar, la confirmación de algo capturado hace rato no debe
      // repetir el toast de creación: ya se avisó al guardarlo.
      if (data.clientRequestId && !onlineManager.isOnline()) return;

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
    onError: (err, data) => {
      revertOptimistic(queryClient, createTaskSpec, data);
      toast.error(err.message ?? "No se pudo crear la tarea");
    },
    onSettled: () => {
      // Invalidating bySystem also covers folderTasks via TanStack Query prefix matching
      queryClient.invalidateQueries({ queryKey: taskKeys.bySystem(systemId) });
    },
  });

  return useStampedMutation(mutation);
}


export function useToggleTask(systemId: string, folderId?: string) {
  return useOptimisticListMutation<ToggleTaskResult, Error, string, TaskTransport>({
    mutationFn: (taskId) => api.tasks.toggle({ id: taskId }),
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
  return useOptimisticListMutation<void, Error, string, TaskTransport>({
    mutationFn: (taskId) => api.tasks.remove({ id: taskId }),
    queryKey: folderId ? taskKeys.folderTasks(systemId, folderId) : taskKeys.bySystem(systemId),
    updater: (tasks, taskId) => tasks.filter((t) => t.id !== taskId),
    // bySystem es prefijo de folderTasks → invalidarla cubre ambas vistas.
    invalidateKey: taskKeys.bySystem(systemId),
  });
}


export function useDeleteTaskWithUndo(systemId: string, folderId?: string) {
  const queryClient = useQueryClient();

  const { mutate: restore } = useMutation({
    mutationFn: (taskId: string) => api.tasks.restore({ id: taskId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.bySystem(systemId) });
      if (folderId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.folderTasks(systemId, folderId) });
      }
    },
  });

  return useMutation({
    mutationFn: (taskId: string) => api.tasks.remove({ id: taskId }),
    onMutate: async (taskId) => {
      const qKey = folderId ? taskKeys.folderTasks(systemId, folderId) : taskKeys.bySystem(systemId);
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<TaskTransport[]>(qKey);
      const deletedTask = previous?.find((t) => t.id === taskId);
      queryClient.setQueryData<TaskTransport[]>(qKey, (old = []) => old.filter((t) => t.id !== taskId));
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
    mutationFn: (taskId: string) => api.tasks.restore({ id: taskId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return useMutation<void, Error, string, { previous?: TaskTransport[]; deletedTask?: TaskTransport }>({
    mutationFn: (taskId: string) => api.tasks.remove({ id: taskId }),
    onMutate: async (taskId) => {
      const qKey = allTasksKey();
      await queryClient.cancelQueries({ queryKey: qKey });
      const previous = queryClient.getQueryData<TaskTransport[]>(qKey);
      const deletedTask = previous?.find((t) => t.id === taskId);
      queryClient.setQueryData<TaskTransport[]>(qKey, (old = []) => old.filter((t) => t.id !== taskId));
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

  return useMutation<TaskTransport, Error, string>({
    mutationFn: (taskId: string) => api.tasks.restore({ id: taskId }),
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
    TaskTransport,
    Error,
    { taskId: string; data: UpdateTaskInput },
    TaskTransport
  >({
    mutationFn: ({ taskId, data }) => api.tasks.update({ id: taskId, ...data }),
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
  return useOptimisticListMutation<TaskTransport, Error, { taskId: string; boardStatus: string }, TaskTransport>({
    mutationFn: ({ taskId, boardStatus }) => api.tasks.moveBoard({ id: taskId, boardStatus }),
    queryKey: taskKeys.bySystem(systemId),
    updater: (tasks, { taskId, boardStatus }) =>
      tasks.map((t) => {
        if (t.id !== taskId) return t;
        const enteringDone = boardStatus === "done" && t.status !== "done";
        const leavingDone = boardStatus !== "done" && t.boardStatus === "done" && t.status === "done";
        return {
          ...t,
          boardStatus,
          boardStatusChangedAt: new Date().toISOString(),
          ...(enteringDone ? { status: "done", completedAt: new Date().toISOString() } : {}),
          ...(leavingDone ? { status: "today", completedAt: null } : {}),
        } as TaskTransport;
      }),
    invalidateKey: ["tasks"],
  });
}

export function useUpdateCalendarTask(from: string, to: string) {
  const queryClient = useQueryClient();

  return useMutation<TaskTransport, Error, { taskId: string; data: UpdateTaskInput }>({
    mutationFn: ({ taskId, data }) => api.tasks.update({ id: taskId, ...data }),
    onMutate: async ({ taskId, data }) => {
      const calKey = taskKeys.calendarTasks(from, to);
      await queryClient.cancelQueries({ queryKey: calKey });
      await queryClient.cancelQueries({ queryKey: allTasksKey() });

      const previousCal = queryClient.getQueryData<TaskTransport[]>(calKey);
      const previousAll = queryClient.getQueryData<TaskTransport[]>(allTasksKey());

      queryClient.setQueryData<TaskTransport[]>(calKey, (old = []) => {
        const exists = old.some((t) => t.id === taskId);
        if (exists) return old.map((t) => (t.id === taskId ? { ...t, ...data } : t));
        // Adding a previously unscheduled task — pull from allTasks cache
        const allTasks = queryClient.getQueryData<TaskTransport[]>(allTasksKey()) ?? [];
        const task = allTasks.find((t) => t.id === taskId);
        if (task) return [...old, { ...task, ...data }];
        return old;
      });
      queryClient.setQueryData<TaskTransport[]>(allTasksKey(), (old = []) =>
        old.map((t) => (t.id === taskId ? { ...t, ...data } : t)),
      );

      return { previousCal, previousAll };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previousCal?: TaskTransport[]; previousAll?: TaskTransport[] } | undefined;
      if (ctx?.previousCal !== undefined) queryClient.setQueryData(taskKeys.calendarTasks(from, to), ctx.previousCal);
      if (ctx?.previousAll !== undefined) queryClient.setQueryData(allTasksKey(), ctx.previousAll);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "calendar"] });
      queryClient.invalidateQueries({ queryKey: allTasksKey() });
    },
  });
}

