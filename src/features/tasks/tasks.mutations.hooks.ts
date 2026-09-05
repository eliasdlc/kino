"use client";

import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { useConvexMutation } from "@/shared/convex/hooks";
import { type UpdateTaskInput } from "./tasks.types";
import { trackOnce } from "@/shared/observability/analytics.client";

/**
 * Mutaciones de una tarea: crear, editar, completar, borrar y restaurar.
 * Las listas son suscripciones, así que aquí no hay caché que corregir a mano:
 * cada mutación escribe y Convex empuja el cambio a todas las vistas.
 */

const statusLabel: Record<string, string> = {
  today: "Hoy",
  tomorrow: "Mañana",
  week: "Esta semana",
  backlog: "Backlog",
  done: "Completadas",
  archived: "Archivadas",
};

export function useCreateTask(_systemId: string, _folderId?: string) {
  return useConvexMutation(api.tasks.create, {
    onSuccess: (newTask) => {
      // Último paso del funnel de registro: mide que alguien llegó a usar el
      // producto, así que sólo cuenta la primera vez. Ver `trackOnce`.
      trackOnce("first_task_created");
      // Mensaje neutro con el destino real (sirve desde QuickAdd global o desde
      // un sistema): no asume que haya un "Action tab" en pantalla.
      const where = statusLabel[newTask.status] ?? "tu lista";
      toast.success(`"${newTask.title}" creada · ${where}`);
    },
    onError: (err) => toast.error(err.message ?? "No se pudo crear la tarea"),
  });
}

export function useToggleTask(_systemId: string, _folderId?: string) {
  return useConvexMutation(api.tasks.toggle, {
    map: (taskId: string) => ({ id: taskId }),
    onError: (err) => toast.error(err.message ?? "No se pudo actualizar la tarea"),
  });
}

export function useDeleteTask(_systemId: string, _folderId?: string) {
  return useConvexMutation(api.tasks.remove, { map: (taskId: string) => ({ id: taskId }) });
}

/** Borra a la papelera y ofrece deshacer desde el toast. El título viene de la propia mutación. */
function useDeleteWithUndo(errorMessage: string) {
  const restore = useMutation(api.tasks.restore);
  return useConvexMutation(api.tasks.remove, {
    map: (taskId: string) => ({ id: taskId }),
    onSuccess: ({ id, title }) => {
      toast(`"${title}" movida a la papelera`, {
        action: { label: "Deshacer", onClick: () => void restore({ id }) },
        duration: 5000,
      });
    },
    onError: () => toast.error(errorMessage),
  });
}

export function useDeleteTaskWithUndo(_systemId: string, _folderId?: string) {
  return useDeleteWithUndo("No se pudo mover a la papelera");
}

/** Borrado con deshacer para la vista global /tasks, donde cada tarea tiene su propio sistema. */
export function useDeleteAnyTaskWithUndo() {
  return useDeleteWithUndo("No se pudo borrar la tarea");
}

export function useRestoreTask() {
  return useConvexMutation(api.tasks.restore, {
    map: (taskId: string) => ({ id: taskId }),
    onSuccess: (task) => toast.success(`"${task.title}" restaurada`),
    onError: () => toast.error("No se pudo restaurar la tarea"),
  });
}

export function useUpdateTask(_systemId: string) {
  return useConvexMutation(api.tasks.update, {
    map: ({ taskId, data }: { taskId: string; data: UpdateTaskInput }) => ({ id: taskId, ...data }),
  });
}

/** Mueve una tarjeta de columna del board (systemType `project`). */
export function useMoveTaskBoard(_systemId: string) {
  return useConvexMutation(api.tasks.moveBoard, {
    map: ({ taskId, boardStatus }: { taskId: string; boardStatus: string }) => ({ id: taskId, boardStatus }),
  });
}

export function useUpdateCalendarTask(_from: string, _to: string) {
  return useConvexMutation(api.tasks.update, {
    map: ({ taskId, data }: { taskId: string; data: UpdateTaskInput }) => ({ id: taskId, ...data }),
  });
}
