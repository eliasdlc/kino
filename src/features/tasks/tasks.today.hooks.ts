"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type Task } from "./tasks.types";
import { useOptimisticListMutation } from "@/shared/hooks/useOptimisticListMutation";
import { taskKeys } from "./tasks.keys";

/**
 * El plan comprometido de hoy.
 *
 * Extraído de tasks.hooks.ts en KIN-146 (FE-05). Traslado literal: el
 * comportamiento no cambia. `tasks.hooks.ts` sigue reexportando todo, así que
 * ningún consumidor tuvo que cambiar de import.
 */
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



