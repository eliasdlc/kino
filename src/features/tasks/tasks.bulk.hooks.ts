"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useOptimisticScope } from "@/shared/hooks/optimistic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/shared/api/client";
import { type TaskTransport, type TaskPriority } from "./tasks.types";
import { type TaskStatus } from "./tasks.state-machine";
import { computeEnergyBudget, mergeCommitted } from "@/features/energy/energy.budget";
import { userSettingsKey } from "@/features/settings/settings.hooks";
import { type AdvisorBulkAction } from "@/features/energy/energy.service";
import { taskKeys, allTasksKey } from "./tasks.keys";

/**
 * Acciones sobre varias tareas a la vez y las del consejo del día.
 *
 * El status que estos hooks devuelven a su estado anterior sale de la caché,
 * donde vive como texto: la columna es un varchar con CHECK y no un enum, así
 * que el tipo de la fila dice `string`. Volver a estrecharlo al entrar en el
 * contrato es la única forma, y es segura porque el valor lo escribió el
 * servidor.
 */
export function useAdvisorAction() {
  const router = useRouter();

  return useMutation<void, Error, { taskIds: string[]; bulkAction: AdvisorBulkAction; actionLabel: string }>({
    mutationFn: async ({ taskIds, bulkAction }) => {
      if (bulkAction === 'none' || taskIds.length === 0) return;

      if (bulkAction === 'move-tomorrow') {
        await api.tasks.bulkMove({ taskIds, status: 'tomorrow' });
      } else if (bulkAction === 'move-today') {
        await api.tasks.bulkMove({ taskIds, status: 'today' });
      } else if (bulkAction === 'lower-priority') {
        await api.tasks.bulkUpdate({ taskIds, priority: 'high' });
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


/**
 * El deshacer devuelve cada tarea a su valor anterior, y ese valor está en el
 * snapshot que el hook optimista guardó antes de escribir. Antes se leía de la
 * lista global, que podía no estar cargada.
 */
type Snapshot = [readonly unknown[], TaskTransport[] | undefined][];

function findBefore(snapshot: Snapshot, taskId: string): TaskTransport | undefined {
  for (const [, tasks] of snapshot) {
    const found = tasks?.find((t) => t.id === taskId);
    if (found) return found;
  }
  return undefined;
}

function previousStatuses(snapshot: Snapshot, taskIds: string[]) {
  return taskIds.map((id) => ({ id, status: findBefore(snapshot, id)?.status ?? 'backlog' }));
}

function previousPriorities(snapshot: Snapshot, taskIds: string[]) {
  return taskIds.map((id) => ({ id, priority: findBefore(snapshot, id)?.priority ?? null }));
}


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

  const planTasks = queryClient.getQueryData<TaskTransport[]>(taskKeys.todayPlan()) ?? [];
  const allTasks = queryClient.getQueryData<TaskTransport[]>(allTasksKey()) ?? [];
  const committed = taskIds
    .map((id) => allTasks.find((t) => t.id === id))
    .filter((t): t is TaskTransport => t !== undefined);

  const budget = computeEnergyBudget(mergeCommitted(planTasks, committed), limit);
  if (budget.state !== 'over') return undefined;

  return `Energía comprometida: ${budget.committed}/${budget.limit} pts (+${budget.overBy}). Nada bloqueado — solo que lo sepas.`;
}


export function useBulkMove() {
  const queryClient = useQueryClient();

  return useOptimisticScope<void, Error, { taskIds: string[]; status: TaskStatus }, TaskTransport>({
    mutationFn: ({ taskIds, status }) => api.tasks.bulkMove({ taskIds, status }),
    queryKey: ['tasks'],
    updater: (tasks, { taskIds, status }) =>
      tasks.map((t) => (taskIds.includes(t.id) ? { ...t, status } : t)),
    onSuccess: (_data, { taskIds, status }, context) => {
      const n = taskIds.length;
      // El deshacer necesita el status de antes, y está en el snapshot.
      const previousStates = previousStatuses(context?.previous ?? [], taskIds);
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
                api.tasks.update({ id, status: status as TaskStatus })
              )
            );
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
          },
        },
      });
    },
    onError: () => toast.error('No se pudo mover las tareas'),
  });
}


export function useBulkUpdate() {
  const queryClient = useQueryClient();

  return useOptimisticScope<void, Error, { taskIds: string[]; priority: TaskPriority }, TaskTransport>({
    mutationFn: ({ taskIds, priority }) => api.tasks.bulkUpdate({ taskIds, priority }),
    queryKey: ['tasks'],
    updater: (tasks, { taskIds, priority }) =>
      tasks.map((t) => (taskIds.includes(t.id) ? { ...t, priority } : t)),
    onSuccess: (_data, { taskIds }, context) => {
      const previousStates = previousPriorities(context?.previous ?? [], taskIds);
      toast.success('Prioridad actualizada', {
        duration: 7000,
        action: {
          label: 'Deshacer',
          onClick: async () => {
            await Promise.all(
              previousStates
                .filter(({ priority }) => priority !== null)
                .map(({ id, priority }) =>
                  api.tasks.update({ id, priority: priority as TaskPriority })
                )
            );
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
          },
        },
      });
    },
    onError: () => toast.error('No se pudo actualizar la prioridad'),
  });
}

