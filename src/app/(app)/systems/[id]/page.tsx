import { auth } from "@/auth";
import { getSystembyId } from "@/features/systems/systems.service";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTasksBySystem } from "@/features/tasks/tasks.service";
import { PageWrapper } from "@/components/PageWrapper";
import { SystemDetailHeader } from "@/features/systems/SystemDetailHeader";
import { SystemDetailTabs } from "@/features/systems/SystemDetailTabs";

export default async function SystemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  const system = await getSystembyId(id, session.user.id);
  const tasks = await getTasksBySystem(id, session.user.id);

  if (!system) notFound();

  return (
    <PageWrapper className="w-full">
      <SystemDetailHeader system={system} taskCount={tasks.length} />
      
      <SystemDetailTabs systemId={id} initialTasks={tasks} />
      
    </PageWrapper>
  );
}
