import { AcademicWorkspace } from "@/features/academic/AcademicWorkspace";
import { resolveSelectedCycle } from "@/features/academic/academic-cycles";
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
  searchParams: Promise<{ tab?: string; cycle?: string }>;
}) {
  const { id } = await params;
  const { tab, cycle } = await searchParams;
  const session = await getServerSession();

  if (!session) redirect("/login");

  // Los ciclos se piden a la vez que el sistema, no después: sólo un sistema
  // académico los tiene, y ahí `academicPeriods.list` rechaza la llamada, que
  // es lo que atrapa el `catch`.
  const [system, periods] = await Promise.all([
    serverQuery(api.systems.detail, { id }).catch(() => null),
    serverQuery(api.academicPeriods.list, { systemId: id }).catch(() => []),
  ]);
  if (!system) notFound();

  // Un sistema académico filtra por ciclo, y el servidor tiene que pedir las
  // tareas con los mismos argumentos que el cliente: si no, el payload que
  // acaba de renderizar no sirve como `initialData` y la lista se pide dos
  // veces en cada carga.
  const academic = system.templateType === "academic";
  const academicPeriodId = academic ? resolveSelectedCycle(periods, cycle ?? null) : undefined;

  const tasks = await serverQuery(api.tasks.bySystem, {
    systemId: id,
    ...(academic ? { academicPeriodId } : {}),
  }).catch(() => null);

  if (!tasks) notFound();

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

  const content =
    surface === "docs" ? (
      <NotebooksView systemId={id} academic={academic} periods={periods} initialTasks={tasks} />
    ) : (
      <SystemDetailView system={system} initialTasks={tasks} />
    );

  return (
    <div className="w-full">
      <div className="sticky top-0 z-(--z-raised) bg-background border-b px-4 md:px-6 py-2.5">
        <PageBreadcrumb
          items={[
            { label: "Sistemas", href: "/systems" },
            { label: system.name },
          ]}
        />
      </div>
      <PageWrapper className="w-full">
        <SystemDetailHeader
          system={system}
          signals={signals}
          currentTab={surface}
          initialPeriods={academic ? periods : undefined}
        />

        <div className="mt-4">
          {academic ? (
            <AcademicWorkspace systemId={id} initialPeriods={periods}>
              {content}
            </AcademicWorkspace>
          ) : (
            content
          )}
        </div>
      </PageWrapper>
    </div>
  );
}
