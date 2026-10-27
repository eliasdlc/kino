import { TasksPageSkeleton } from "@/features/tasks/TasksSkeleton";

/** La forma de Tareas: la misma que pinta la página, del mismo módulo, para que no salte. */
export default function TasksLoading() {
  return <TasksPageSkeleton />;
}
