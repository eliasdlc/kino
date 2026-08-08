"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type Task } from "./tasks.types";
import { computeEnergyBudget, mergeCommitted } from "@/features/energy/energy.budget";
import { userSettingsKey } from "@/features/settings/settings.hooks";
import { type AdvisorBulkAction } from "@/features/energy/energy.service";
import { taskKeys, allTasksKey } from "./tasks.keys";

/**
 * Acciones sobre varias tareas a la vez y las del consejo del día.
 *
 * Extraído de tasks.hooks.ts en KIN-146 (FE-05). Traslado literal: el
 * comportamiento no cambia. `tasks.hooks.ts` sigue reexportando todo, así que
 * ningún consumidor tuvo que cambiar de import.
 */
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
      const overdraft = status === 'today' ? overdraftNotice(queryClient, taskIds) : undefined;
      // Con richColors, `toast.success` sale verde con check: leerlo encima de un
      // aviso de sobregiro se contradice. El movimiento sí ocurrió —nada bloquea—
      // pero el tono lo marca el aviso, igual que al aceptar una sugerencia.
      const notify = overdraft ? toast.warning : toast.success;
      notify(`${n} tarea${n !== 1 ? 's' : ''} movida${n !== 1 ? 's' : ''}`, {
        description: overdraft,
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

