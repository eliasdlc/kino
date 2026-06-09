import { auth } from '@/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUsersSystems } from '@/features/systems/systems.service';
import { TasksPageClient } from '@/features/tasks/TasksPage';

export const metadata = { title: 'Tasks - Kino' };

export default async function TasksPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const raw = await getUsersSystems(session.user.id);
  const systems = raw.map((s) => ({ id: s.id, name: s.name, color: s.color ?? null }));

  return <TasksPageClient systems={systems} />;
}
