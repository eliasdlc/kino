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
 * Ninguna mutación de tareas es optimista: esperan la respuesta, y la
 * suscripción de Convex repinta cada lista cuando la base cambia. El patrón
 * optimista vive en `useConvexMutation` (`@/shared/convex/hooks`), con la
 * opción `optimisticUpdate`, y hoy lo usa un solo hook: `useUpdateStickyNote`,
 * para que una nota soltada no vuelva a su sitio viejo durante el viaje.
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
