"use client";

import { api } from "@convex/_generated/api";
import { useConvexQuery } from "@/shared/convex/hooks";
import { type TaskTransport } from "./tasks.types";

/**
 * Lecturas de tareas. Son suscripciones: cuando una mutación cambia la base,
 * cada lista se actualiza sola, sin claves que invalidar.
 */

/** Tareas en la papelera de un sistema. */
export function useTrashedTasks(systemId: string, enabled = true) {
  return useConvexQuery(api.tasks.list, { systemId, deleted: true }, { enabled });
}

/** La lista de un sistema. `initialData` es lo que pintó el servidor, hasta que llega la suscripción. */
export function useTasks(systemId: string, initialData: TaskTransport[]) {
  const result = useConvexQuery(api.tasks.bySystem, { systemId });
  return { ...result, data: result.data ?? initialData };
}

export function useFolderTasks(systemId: string, folderId: string, initialData?: TaskTransport[]) {
  const result = useConvexQuery(api.tasks.byFolder, { systemId, folderId }, { enabled: !!folderId });
  return { ...result, data: result.data ?? initialData };
}

export function useSubtasks(taskId: string, _systemId: string, options?: { enabled?: boolean }) {
  return useConvexQuery(api.tasks.subtasks, { id: taskId }, options);
}

export function useAllTasks() {
  return useConvexQuery(api.tasks.list, {});
}

export type { SuggestedTask } from "@/features/insights/insights.hooks";

export function useSuggestedTasks() {
  return useConvexQuery(api.insights.suggest, { limit: 10 });
}

export function useCalendarTasks(from: string, to: string) {
  return useConvexQuery(api.tasks.calendar, { from, to });
}
