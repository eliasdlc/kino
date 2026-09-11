import { notFound, redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import type { BreadcrumbItem } from "@/components/PageBreadcrumb";
import { NotebookEditorLayout } from "@/features/pages/NotebookEditorLayout";
import { MEDIUM_CONFIG, resolveMedium } from "@/shared/lib/mediums";
import { getServerSession } from "@/shared/utils/session";

interface PageEditorRouteProps {
  params: Promise<{ id: string; pageId: string }>;
}

export default async function PageEditorRoute({ params }: PageEditorRouteProps) {
  const { id: systemId, pageId } = await params;
  const session = await getServerSession();

  if (!session) redirect("/login");

  const [page, system] = await Promise.all([
    serverQuery(api.pages.byId, { id: pageId }).catch(() => null),
    serverQuery(api.systems.byId, { id: systemId }).catch(() => null),
  ]);

  if (!page || !system || page.systemId !== systemId) notFound();

  const writer = system.templateType === "writing";
  const isSubPage = !!page.parentPageId;
  const rootPageId = page.parentPageId ?? pageId;
  const [folder, parentNotebook, initialSubPages, allPages] = await Promise.all([
    page.folderId ? serverQuery(api.folders.detail, { id: page.folderId }) : null,
    page.parentPageId ? serverQuery(api.pages.byId, { id: page.parentPageId }) : null,
    serverQuery(api.pages.subpages, { id: rootPageId }),
    writer && page.folderId
      ? serverQuery(api.pages.bySystem, { systemId, folderId: page.folderId }).then((result) => result.items)
      : [],
  ]);
  const folderAncestors = folder?.breadcrumb ?? [];

  // El medium de la obra gobierna nodos, slash menu, plantilla y export.
  // Un manuscrito suelto (sin obra) escribe en prosa con el medium por defecto.
  const medium = writer ? MEDIUM_CONFIG[resolveMedium(folder?.metadata)] : null;
  const wordGoalRaw = folder?.metadata?.wordGoal;
  const wordGoal =
    typeof wordGoalRaw === "number"
      ? wordGoalRaw
      : typeof wordGoalRaw === "string"
        ? Number(wordGoalRaw) || null
        : null;
  const obra =
    writer && folder
      ? {
          id: folder.id,
          name: folder.name,
          wordGoal,
          wordsExcludingCurrent: allPages
            .filter((p) => p.folderId === folder.id && p.id !== page.id)
            .reduce((sum, p) => sum + p.wordCount, 0),
        }
      : null;

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Sistemas", href: "/systems" },
    { label: system.name, href: `/systems/${systemId}` },
    ...folderAncestors.map((crumb) => ({
      label: crumb.name,
      href: `/systems/${systemId}/folders/${crumb.id}`,
    })),
    ...(folder
      ? [{ label: folder.name, href: `/systems/${systemId}/folders/${folder.id}` }]
      : []),
    ...(isSubPage && parentNotebook
      ? [{ label: parentNotebook.title ?? "Sin título", href: `/systems/${systemId}/pages/${parentNotebook.id}` }]
      : []),
    { label: page.title ?? "Sin título" },
  ];

  return (
    <NotebookEditorLayout
      page={page}
      systemId={systemId}
      systemName={system.name}
      breadcrumbItems={breadcrumbItems}
      parentNotebook={parentNotebook ? { id: parentNotebook.id, title: parentNotebook.title } : null}
      initialSubPages={initialSubPages}
      writer={writer}
      obra={obra}
      obraMetadata={writer ? (folder?.metadata ?? null) : null}
      medium={medium}
    />
  );
}
