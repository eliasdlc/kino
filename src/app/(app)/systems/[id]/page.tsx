import { notFound, redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { PageWrapper } from "@/components/PageWrapper";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { SystemDetailHeader } from "@/features/systems/SystemDetailHeader";
import type { SystemSignals } from "@/features/systems/systems.signals";
import { SystemDetailView } from "@/features/systems/views/SystemDetailView";
import { NotebooksView } from "@/features/notebooks/NotebooksView";
import { landingSurface } from "@/shared/lib/system-manifest";
import { getServerSession } from "@/shared/utils/session";

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

  // La lista ya trae las señales de cada sistema; el detalle es uno de ellos.
  const [systems, tasks] = await Promise.all([
    serverQuery(api.systems.list, {}),
    serverQuery(api.tasks.bySystem, { systemId: id }).catch(() => null),
  ]);
  const system = systems.find((s) => s.id === id);

  if (!system || !tasks) notFound();

  const nextDue = tasks
    .filter((t) => t.status !== "done" && t.dueDate)
    .map((t) => t.dueDate!)
    .sort()[0];
  const signals: SystemSignals = {
    status: system.stale ? "stale" : "active",
    stale: system.stale,
    daysSinceLastActivity: system.daysSinceLastActivity,
    activeTaskCount: system.activeTaskCount,
    nextDueDate: nextDue ?? null,
  };
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
        <SystemDetailHeader system={system} signals={signals} currentTab={surface} />

        <div className="mt-4">
          {surface === "docs" ? (
            <NotebooksView systemId={id} />
          ) : (
            <SystemDetailView system={system} initialTasks={tasks} />
          )}
        </div>
      </PageWrapper>
    </div>
  );
}
