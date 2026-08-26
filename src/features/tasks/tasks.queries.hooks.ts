"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { type TaskTransport } from "./tasks.types";
import { taskKeys, allTasksKey, suggestedTasksKey } from "./tasks.keys";

/**
 * Queries de lectura de tareas.
 *
 * Las URLs y los casts se fueron con el contrato: `api.tasks.*` ya sabe qué
 * recibe y qué devuelve, y un error de red o del servidor llega como excepción,
 * que es lo que TanStack Query necesita.
 */

/** Tareas en la papelera (deleted_at IS NOT NULL) de un sistema. */
export function useTrashedTasks(systemId: string, enabled = true) {
  return useQuery({
    queryKey: taskKeys.trash(systemId),
    // `deleted` viaja por la query string, donde todo es texto: el schema de la
    // ruta es el que lo convierte en booleano.
    queryFn: () => api.tasks.list({ systemId, deleted: "true" }),
    enabled,
  });
}


export function useTasks(systemId: string, initialData: TaskTransport[]) {
  return useQuery({
    queryKey: taskKeys.bySystem(systemId),
    queryFn: () => api.tasks.bySystem({ systemId }),
    initialData,
    initialDataUpdatedAt: 0,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}


export function useFolderTasks(
  systemId: string,
  folderId: string,
  initialData?: TaskTransport[],
) {
  return useQuery({
    queryKey: taskKeys.folderTasks(systemId, folderId),
    queryFn: () => api.tasks.byFolder({ systemId, folderId }),
    enabled: !!folderId,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    ...(initialData !== undefined ? { initialData, initialDataUpdatedAt: 0 } : {}),
  });
}


export function useSubtasks(
  taskId: string,
  _systemId: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: taskKeys.subtasks(taskId),
    queryFn: () => api.tasks.subtasks({ id: taskId }),
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}


export function useAllTasks() {
  return useQuery({
    queryKey: allTasksKey(),
    queryFn: () => api.tasks.list({}),
    staleTime: 30_000,
  });
}

/**
 * La sugerencia de `insights`, que todavía sirve su propia ruta. El tipo es el
 * de transporte igual: lo que describe no es qué handler contestó, sino lo que
 * sobrevive al viaje.
 */
export type SuggestedTask = TaskTransport & {
  importanceScore: number;
  why: string;
  energyBand: string;
};


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


export function useCalendarTasks(from: string, to: string) {
  return useQuery({
    queryKey: taskKeys.calendarTasks(from, to),
    queryFn: () => api.tasks.calendar({ from, to }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
