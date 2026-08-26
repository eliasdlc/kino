"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/api/client";
import { type TaskTransport } from "./tasks.types";
import { useOptimisticListMutation } from "@/shared/hooks/useOptimisticListMutation";
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
  const queryClient = useQueryClient();
  return useMutation<{ status: string }, Error, { taskId: string }>({
    mutationFn: ({ taskId }) => api.tasks.toggle({ id: taskId }),
    // Optimista sobre TODAS las queries de tareas (today-plan, all, system…) por
    // prefijo, para que la vista visible reaccione sin importar de cuál lea.
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueriesData<TaskTransport[]>({ queryKey: ['tasks'] });
      queryClient.setQueriesData<TaskTransport[]>({ queryKey: ['tasks'] }, (old) =>
        old?.map((t) =>
          t.id === taskId
            ? { ...t, status: t.status === 'done' ? 'today' : 'done', completedAt: t.status === 'done' ? null : new Date().toISOString() }
            : t,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      const c = ctx as { previous?: [readonly unknown[], TaskTransport[] | undefined][] } | undefined;
      c?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error('No se pudo guardar. Intenta de nuevo.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}


export function useMoveToTomorrow() {
  return useOptimisticListMutation<unknown, Error, { taskId: string; tomorrow: string }, TaskTransport>({
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
  return useMutation<unknown, Error, { taskId: string }>({
    mutationFn: ({ taskId }) => api.tasks.update({ id: taskId, inTodayPlan: true }),
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.todayPlan() });
      const previous = queryClient.getQueryData<TaskTransport[]>(taskKeys.todayPlan());
      return { previous, taskId };
    },
    onError: (_err, _vars, ctx) => {
      const c = ctx as { previous?: TaskTransport[] } | undefined;
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
  return useOptimisticListMutation<unknown, Error, { taskId: string }, TaskTransport>({
    mutationFn: ({ taskId }) => api.tasks.update({ id: taskId, inTodayPlan: false }),
    queryKey: taskKeys.todayPlan(),
    updater: (tasks, { taskId }) => tasks.filter((t) => t.id !== taskId),
    onError: () => toast.error('No se pudo quitar del plan. Intenta de nuevo.'),
  });
}
