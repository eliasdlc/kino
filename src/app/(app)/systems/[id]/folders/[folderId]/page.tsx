import { Suspense } from "react";
import { AcademicWorkspace } from "@/features/academic/AcademicWorkspace";
import { AcademicSubjectView } from "@/features/academic/AcademicSubjectView";
import { notFound, redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { PageHeader, PageWrapper } from "@/components/PageWrapper";
import { RowsSkeleton } from "@/components/Skeletons";
import { FolderDocuments } from "@/features/notebooks/FolderDocuments";
import { Folder } from "lucide-react";
import { IndexHead } from "@/features/notebooks/IndexHead";

import { TasksList } from "@/features/tasks/TasksList";
import { resolveSystemManifest } from "@/shared/lib/system-manifest";
import { containerDetailEmptyCopy } from "@/shared/lib/archetype-copy";
import { getServerSession } from "@/shared/utils/session";

interface FolderViewRouteProps {
  params: Promise<{ id: string; folderId: string }>;
  searchParams: Promise<{ cycle?: string }>;
}

export default async function FolderViewRoute({ params, searchParams }: FolderViewRouteProps) {
  const { id: systemId, folderId } = await params;
  const { cycle } = await searchParams;
  const session = await getServerSession();

  if (!session) redirect("/login");

  // Las migas sólo necesitan estas dos lecturas, y las dos son por id. El resto
  // del contenido llega detrás sin hacerlas esperar.
  const [folder, system] = await Promise.all([
    serverQuery(api.folders.detail, { id: folderId }).catch(() => null),
    serverQuery(api.systems.byId, { id: systemId }).catch(() => null),
  ]);

  if (!folder || !system || folder.systemId !== systemId) notFound();

  // Volver al sistema devuelve a la superficie desde la que se entró, con el
  // mismo ciclo: perder el filtro al subir un nivel obligaba a volver a
  // elegirlo en cada ida y vuelta.
  const systemHref = `/systems/${systemId}?tab=docs${cycle ? `&cycle=${encodeURIComponent(cycle)}` : ""}`;

  const breadcrumbItems = [
    { label: "Sistemas", href: "/systems" },
    { label: system.name, href: systemHref },
    ...folder.breadcrumb.map((crumb) => ({
      label: crumb.name,
      href: `/systems/${systemId}/folders/${crumb.id}`,
    })),
    { label: folder.name },
  ];

  return (
    <div className="w-full">
      <div className="sticky top-0 z-(--z-raised) hidden border-b bg-background px-4 py-2.5 md:block md:px-6">
        <PageBreadcrumb items={breadcrumbItems} />
      </div>
      <PageWrapper className="w-full">
        <Suspense fallback={<FolderSkeleton />}>
          <FolderContent systemId={systemId} folderId={folderId} folder={folder} system={system} />
        </Suspense>
      </PageWrapper>
    </div>
  );
}

/** El índice de la carpeta esperando: las filas numeradas de sus documentos. */
function FolderSkeleton() {
  return (
    <div aria-busy>
      <RowsSkeleton rows={4} margin="numeral" />
    </div>
  );
}

type FolderDetail = Awaited<ReturnType<typeof serverQuery<typeof api.folders.detail>>>;
type SystemItem = Awaited<ReturnType<typeof serverQuery<typeof api.systems.byId>>>;

async function FolderContent({
  systemId,
  folderId,
  folder,
  system,
}: {
  systemId: string;
  folderId: string;
  folder: FolderDetail;
  system: SystemItem;
}) {
  const [children, allPages, folderTasks, periods] = await Promise.all([
    serverQuery(api.folders.children, { id: folderId }),
    serverQuery(api.pages.bySystem, { systemId, folderId }),
    serverQuery(api.tasks.byFolder, { systemId, folderId }),
    serverQuery(api.academicPeriods.list, { systemId }).catch(() => []),
  ]);

  const academic = system.templateType === "academic";
  const emptyCopy = containerDetailEmptyCopy(resolveSystemManifest(system));

  const documents = (
    <FolderDocuments
      systemId={systemId}
      folderId={folderId}
      initialChildren={children}
      initialPages={allPages}
      emptyCopy={emptyCopy}
    />
  );

  if (!academic) {
    // El glifo del contenedor del arquetipo (la obra, el área), no uno genérico.
    const Glyph = resolveSystemManifest(system).folderRole?.icon ?? Folder;
    return (
      <div className="space-y-7">
        <PageHeader title={folder.name} margin={<Glyph className="size-5" aria-hidden />} />
        {documents}
        <section aria-labelledby={`${folderId}-tareas`} className="space-y-3">
          <IndexHead id={`${folderId}-tareas`} title="Tareas" />
          <TasksList systemId={systemId} initialData={[]} folderId={folderId} folderInitialData={folderTasks} />
        </section>
      </div>
    );
  }

  // El ciclo lo lleva la materia raíz: una subcarpeta no puede contradecirlo.
  const subject = folder.breadcrumb[0] ?? folder;

  return (
    <AcademicWorkspace systemId={systemId} folderId={folderId}>
      <AcademicSubjectView
        system={system}
        folder={folder}
        subject={subject}
        periods={periods}
        initialTasks={folderTasks}
        documents={documents}
      />
    </AcademicWorkspace>
  );
}
