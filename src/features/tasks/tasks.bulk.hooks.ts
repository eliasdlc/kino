"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { useConvexMutation, useLocalMutation } from "@/shared/convex/hooks";
import { type TaskTransport, type TaskPriority } from "./tasks.types";
import { type TaskStatus } from "./tasks.state-machine";
import { computeEnergyBudget, mergeCommitted } from "@/features/energy/energy.budget";
import { useUserSettings } from "@/features/settings/settings.hooks";
import { type AdvisorBulkAction } from "@/features/energy/energy.types";
import { useAllTasks } from "./tasks.queries.hooks";
import { useTodayPlanTasks } from "./tasks.today.hooks";

/** Acciones sobre varias tareas a la vez y las del consejo del día. */
export function useAdvisorAction() {
  const router = useRouter();
  const bulkMove = useMutation(api.tasks.bulkMove);
  const bulkUpdate = useMutation(api.tasks.bulkUpdate);

  return useLocalMutation(
    async ({ taskIds, bulkAction }: { taskIds: string[]; bulkAction: AdvisorBulkAction; actionLabel: string }) => {
      if (bulkAction === 'none' || taskIds.length === 0) return;
      if (bulkAction === 'move-tomorrow') {
        await bulkMove({ taskIds: taskIds as never, status: 'tomorrow' });
      } else if (bulkAction === 'move-today') {
        await bulkMove({ taskIds: taskIds as never, status: 'today' });
      } else if (bulkAction === 'lower-priority') {
        await bulkUpdate({ taskIds: taskIds as never, priority: 'high' });
      }
    },
    {
      onSuccess: (_data, { actionLabel }) => {
        toast.success(actionLabel);
        router.refresh();
      },
      onError: (err) => toast.error(err.message ?? 'Error al ejecutar la acción'),
    },
  );
}

/**
 * Aviso de sobregiro tras comprometer tareas al día. Se calcula con el plan de
 * hoy más el límite de ajustes, y sólo cuenta las tareas que aún no estaban en
 * el plan. `undefined` si no hay sobregiro o falta el límite.
 */
function useOverdraftNotice() {
  const { data: settings } = useUserSettings();
  const { data: planTasks = [] } = useTodayPlanTasks();
  const { data: allTasks = [] } = useAllTasks();
  return (taskIds: string[]): string | undefined => {
    const limit = settings?.dailyEnergyLimit;
    if (!limit) return undefined;
    const committed = taskIds
      .map((id) => allTasks.find((t) => t.id === id))
      .filter((t): t is TaskTransport => t !== undefined);
    const budget = computeEnergyBudget(mergeCommitted(planTasks, committed), limit);
    if (budget.state !== 'over') return undefined;
    return `Energía comprometida: ${budget.committed}/${budget.limit} pts (+${budget.overBy}). Nada bloqueado, solo que lo sepas.`;
  };
}

export function useBulkMove() {
  const update = useMutation(api.tasks.update);
  const overdraftFor = useOverdraftNotice();

  return useConvexMutation(api.tasks.bulkMove, {
    map: ({ taskIds, status }: { taskIds: string[]; status: TaskStatus }) => ({ taskIds, status: status as never }),
    onSuccess: ({ previous }, { taskIds, status }) => {
      const n = taskIds.length;
      const overdraft = status === 'today' ? overdraftFor(taskIds) : undefined;
      // Con richColors, `toast.success` sale verde con check: leerlo encima de un
      // aviso de sobregiro se contradice. El movimiento sí ocurrió, pero el tono
      // lo marca el aviso.
      const notify = overdraft ? toast.warning : toast.success;
      notify(`${n} tarea${n !== 1 ? 's' : ''} movida${n !== 1 ? 's' : ''}`, {
        description: overdraft,
        duration: 7000,
        action: {
          label: 'Deshacer',
          onClick: async () => {
            await Promise.all(previous.map(({ id, status }) => update({ id, status: status as never })));
          },
        },
      });
    },
    onError: () => toast.error('No se pudo mover las tareas'),
  });
}

export function useBulkUpdate() {
  const update = useMutation(api.tasks.update);

  return useConvexMutation(api.tasks.bulkUpdate, {
    map: ({ taskIds, priority }: { taskIds: string[]; priority: TaskPriority }) => ({ taskIds, priority }),
    onSuccess: ({ previous }) => {
      toast.success('Prioridad actualizada', {
        duration: 7000,
        action: {
          label: 'Deshacer',
          onClick: async () => {
            await Promise.all(previous.map(({ id, priority }) => update({ id, priority })));
          },
        },
      });
    },
    onError: () => toast.error('No se pudo actualizar la prioridad'),
  });
}
