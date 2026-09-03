import { getSystemById } from "@/features/systems/systems.service";
import { notFound, redirect } from "next/navigation";
import { getTasksBySystem } from "@/features/tasks/tasks.service";
import { PageWrapper } from "@/components/PageWrapper";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { SystemDetailHeader } from "@/features/systems/SystemDetailHeader";
import { computeSystemSignals } from "@/features/systems/systems.signals";
import { SystemDetailView } from "@/features/systems/views/SystemDetailView";
import { NotebooksView } from "@/features/notebooks/NotebooksView";
import { landingSurface } from "@/shared/lib/system-manifest";
import { getServerSession } from "@/shared/utils/session";
import { toTransport } from "@/shared/api/transport";

export default async function SystemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const session = await getServerSession();

  if (!session) redirect("/login");

  const system = await getSystemById(id, session.user.id);
  const tasks = await getTasksBySystem(id, session.user.id);

  if (!system) notFound();

  const signals = computeSystemSignals(system, tasks);
  // Sin `?tab=`, manda la composición: un sistema cuyas páginas son primarias
  // abre en su biblioteca, no en el funnel de tareas.
  const surface = tab === "docs" ? "docs" : tab === "tasks" ? "tasks" : landingSurface(system);

  return (
    <div className="w-full">
      <div className="sticky top-0 z-10 bg-background border-b px-4 md:px-6 py-2.5">
        <PageBreadcrumb
          items={[
            { label: "Sistemas", href: "/systems" },
            { label: system.name },
          ]}
        />
      </div>
      <PageWrapper className="w-full">
        <SystemDetailHeader system={toTransport(system)} signals={signals} currentTab={surface} />

        <div className="mt-4">
          {surface === "docs" ? (
            <NotebooksView systemId={id} />
          ) : (
            <SystemDetailView system={toTransport(system)} initialTasks={toTransport(tasks)} />
          )}
        </div>
      </PageWrapper>
    </div>
  );
}
