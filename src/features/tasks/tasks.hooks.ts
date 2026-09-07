"use client";

/**
 * Punto de entrada de los hooks de tareas.
 *
 * El archivo tenía 898 líneas y se partió por dominio en KIN-146 (FE-05). Sigue
 * siendo el import canónico (`from "./tasks.hooks"`) para no tocar los ~40
 * consumidores: aquí sólo se reexporta, no vive lógica.
 *
 * Dónde está cada cosa:
 * - `tasks.queries.hooks.ts`   lecturas
 * - `tasks.mutations.hooks.ts` crear, editar, completar, borrar, restaurar
 * - `tasks.bulk.hooks.ts`      acciones sobre varias tareas y el consejo del día
 * - `tasks.reminders.hooks.ts` recordatorios
 * - `tasks.today.hooks.ts`     el plan comprometido de hoy
 *
 * El patrón optimista canónico (Rumbo 05) no vive aquí: está en
 * `@/shared/hooks/optimistic`, con su test y su doc al lado.
 * Ojo con los hooks que lo evitan a propósito (`useCreateTask` toca dos query
 * keys a la vez) y conservan el patrón inline con su comentario explicándolo.
 */

export {
  useTrashedTasks,
  useTasks,
  useFolderTasks,
  useSubtasks,
  useAllTasks,
  useSuggestedTasks,
  useCalendarTasks,
  type SuggestedTask,
} from "./tasks.queries.hooks";

export {
  useCreateTask,
  useToggleTask,
  useDeleteTask,
  useDeleteTaskWithUndo,
  useDeleteAnyTaskWithUndo,
  useRestoreTask,
  useUpdateTask,
  useMoveTaskBoard,
  useUpdateCalendarTask,
} from "./tasks.mutations.hooks";

export { useAdvisorAction, useBulkMove, useBulkUpdate } from "./tasks.bulk.hooks";

export {
  useTaskReminders,
  useCreateTaskReminder,
  useDeleteTaskReminder,
  type TaskReminder,
} from "./tasks.reminders.hooks";

export {
  useTodayPlanTasks,
  useToggleTodayTask,
  useMoveToTomorrow,
  useAddToTodayPlan,
  useRemoveFromPlan,
} from "./tasks.today.hooks";
