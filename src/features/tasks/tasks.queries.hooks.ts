"use client";

import { useQuery } from "@tanstack/react-query";
import { type Task } from "./tasks.types";
import { taskKeys, allTasksKey, suggestedTasksKey } from "./tasks.keys";

/**
 * Queries de lectura de tareas.
 *
 * Extraído de tasks.hooks.ts en KIN-146 (FE-05). Traslado literal: el
 * comportamiento no cambia. `tasks.hooks.ts` sigue reexportando todo, así que
 * ningún consumidor tuvo que cambiar de import.
 */
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

