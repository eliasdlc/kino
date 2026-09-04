import { api } from '@convex/_generated/api';
import { serverMutation, serverQuery } from '@/shared/convex/server';
import { TasksPageClient } from '@/features/tasks/TasksPage';

export const metadata = { title: 'Tasks - Kino' };

export default async function TasksPage() {
  // Rollover lazy (idempotente, una vez al día) antes de leer las tareas.
  await serverMutation(api.tasks.rollTodayPlan, {});
  const raw = await serverQuery(api.systems.list, {});
  const systems = raw.map((s) => ({ id: s.id, name: s.name, color: s.color ?? null }));
  return <TasksPageClient systems={systems} />;
}
