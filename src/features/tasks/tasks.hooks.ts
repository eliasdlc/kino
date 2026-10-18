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
 * Completar es la única mutación de tareas optimista (`useToggleTask` y
 * `useToggleTodayTask`, con `toggleLocally` de `tasks.optimistic.ts`): el
 * círculo se rellena en el toque y Convex lo deshace solo si falla. Las demás
 * esperan la respuesta, y la suscripción repinta cada lista cuando la base
 * cambia. El patrón vive en `useConvexMutation` (`@/shared/convex/hooks`),
 * opción `optimisticUpdate`; también lo usa `useUpdateStickyNote`.
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
