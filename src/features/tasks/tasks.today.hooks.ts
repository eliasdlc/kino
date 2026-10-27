"use client";

import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import { toggleLocally } from "./tasks.optimistic";

/** El plan comprometido de hoy. */
export function useTodayPlanTasks() {
  return useConvexQuery(api.tasks.todayPlan, {});
}

/** Completar o deshacer, optimista: el círculo cambia en el toque (`tasks.optimistic.ts`). */
export function useToggleTodayTask() {
  return useConvexMutation(api.tasks.toggle, {
    map: ({ taskId }: { taskId: string }) => ({ id: taskId }),
    optimisticUpdate: toggleLocally,
    onError: () => toast.error('No se pudo guardar. Intenta de nuevo.'),
  });
}

/** Mueve la programación (startDate), nunca la fecha límite, y saca la tarea del plan de hoy. */
export function useMoveToTomorrow() {
  return useConvexMutation(api.tasks.update, {
    map: ({ taskId, tomorrow }: { taskId: string; tomorrow: string }) => ({ id: taskId, startDate: tomorrow, inTodayPlan: false }),
    onError: () => toast.error('No se pudo mover. Intenta de nuevo.'),
  });
}

export function useAddToTodayPlan() {
  return useConvexMutation(api.tasks.update, {
    map: ({ taskId }: { taskId: string }) => ({ id: taskId, inTodayPlan: true }),
    onError: () => toast.error('No se pudo agregar al plan.'),
  });
}

export function useRemoveFromPlan() {
  return useConvexMutation(api.tasks.update, {
    map: ({ taskId }: { taskId: string }) => ({ id: taskId, inTodayPlan: false }),
    onError: () => toast.error('No se pudo quitar del plan. Intenta de nuevo.'),
  });
}
