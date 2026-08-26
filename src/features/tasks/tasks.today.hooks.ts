"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/api/client";
import { type TaskTransport } from "./tasks.types";
import { useOptimisticList, useOptimisticScope } from "@/shared/hooks/optimistic";
import { taskKeys } from "./tasks.keys";

/** El plan comprometido de hoy. */
export function useTodayPlanTasks() {
  return useQuery({
    queryKey: taskKeys.todayPlan(),
    queryFn: () => api.tasks.todayPlan({}),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}


export function useToggleTodayTask() {
  // Una tarea vive a la vez en el plan de hoy, en la lista global y en la de su
  // sistema: completarla tiene que verse en las tres, no sólo en la de delante.
  return useOptimisticScope<{ status: string }, Error, { taskId: string }, TaskTransport>({
    mutationFn: ({ taskId }) => api.tasks.toggle({ id: taskId }),
    queryKey: ['tasks'],
    updater: (tasks, { taskId }) =>
      tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: t.status === 'done' ? 'today' : 'done',
              completedAt: t.status === 'done' ? null : new Date().toISOString(),
            }
          : t,
      ),
    onError: () => toast.error('No se pudo guardar. Intenta de nuevo.'),
  });
}


export function useMoveToTomorrow() {
  return useOptimisticList<unknown, Error, { taskId: string; tomorrow: string }, TaskTransport>({
    mutationFn: async ({ taskId, tomorrow }) => {
      // Mover en la PROGRAMACIÓN (startDate), no en la fecha límite. El service
      // deriva status 'tomorrow' desde startDate; inTodayPlan explícito lo saca
      // del plan de hoy. Nunca tocamos dueDate (es el deadline del usuario).
      return api.tasks.update({ id: taskId, startDate: tomorrow, inTodayPlan: false });
    },
    queryKey: taskKeys.todayPlan(),
    updater: (tasks, { taskId }) => tasks.filter((t) => t.id !== taskId),
    onError: () => toast.error('No se pudo mover. Intenta de nuevo.'),
  });
}


export function useAddToTodayPlan() {
  const queryClient = useQueryClient();
  // La tarea que entra no está en esta lista todavía, así que no hay nada que
  // pintar: el optimismo aquí es sólo no dejar la lista vieja si el PATCH falla.
  return useOptimisticList<unknown, Error, { taskId: string }, TaskTransport>({
    mutationFn: ({ taskId }) => api.tasks.update({ id: taskId, inTodayPlan: true }),
    queryKey: taskKeys.todayPlan(),
    updater: (tasks) => tasks,
    onError: () => toast.error('No se pudo agregar al plan.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] }),
  });
}


export function useRemoveFromPlan() {
  return useOptimisticList<unknown, Error, { taskId: string }, TaskTransport>({
    mutationFn: ({ taskId }) => api.tasks.update({ id: taskId, inTodayPlan: false }),
    queryKey: taskKeys.todayPlan(),
    updater: (tasks, { taskId }) => tasks.filter((t) => t.id !== taskId),
    onError: () => toast.error('No se pudo quitar del plan. Intenta de nuevo.'),
  });
}
