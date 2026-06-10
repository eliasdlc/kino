import { auth } from '@/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import getQueryClient from '@/lib/get-query-client';
import { getUsersSystems } from '@/features/systems/systems.service';
import { queryTasks, ensureTodayPlanRolled } from '@/features/tasks/tasks.service';
import { getSuggestedTasks } from '@/features/insights/insights.service';
import { allTasksKey, suggestedTasksKey } from '@/features/tasks/tasks.keys';
import { TasksPageClient } from '@/features/tasks/TasksPage';

export const metadata = { title: 'Tasks - Kino' };

export default async function TasksPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const userId = session.user.id;

  // Rollover lazy (idempotent, runs once/day) before reading tasks.
  await ensureTodayPlanRolled(userId);

  const queryClient = getQueryClient();

  // Prefetch in parallel: systems (for props), all tasks, and suggested tasks.
  const [raw] = await Promise.all([
    getUsersSystems(userId),
    queryClient.prefetchQuery({
      queryKey: allTasksKey(),
      queryFn: () => queryTasks(userId, {}),
    }),
    queryClient.prefetchQuery({
      queryKey: suggestedTasksKey(),
      queryFn: () => getSuggestedTasks(userId, 10),
    }),
  ]);

  const systems = raw.map((s) => ({ id: s.id, name: s.name, color: s.color ?? null }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TasksPageClient systems={systems} />
    </HydrationBoundary>
  );
}
