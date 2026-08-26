import { notFound, redirect } from "next/navigation";
import { getPageById, getPagesBySystem, getSubPages } from "@/features/pages/pages.service";
import { getSystemById } from "@/features/systems/systems.service";
import { getFolderById, getFolderBreadcrumb } from "@/features/folders/folders.service";
import type { BreadcrumbItem } from "@/components/PageBreadcrumb";
import { NotebookEditorLayout } from "@/features/pages/NotebookEditorLayout";
import { MEDIUM_CONFIG, resolveMedium } from "@/shared/lib/mediums";
import type { PageListItemTransport } from "@/features/pages/pages.types";
import { getServerSession } from "@/shared/utils/session";
import { toTransport } from "@/shared/api/transport";

interface PageEditorRouteProps {
  params: Promise<{ id: string; pageId: string }>;
}

export default async function PageEditorRoute({ params }: PageEditorRouteProps) {
  const { id: systemId, pageId } = await params;
  const session = await getServerSession();

  if (!session) redirect("/login");

  const [page, system, allPages] = await Promise.all([
    getPageById(pageId, session.user.id),
    getSystemById(systemId, session.user.id),
    getPagesBySystem(systemId, session.user.id),
  ]);

  if (!page || !system) notFound();

  const folder = page.folderId
    ? await getFolderById(page.folderId, session.user.id)
    : null;
  const folderAncestors =
    folder ? await getFolderBreadcrumb(folder.path, session.user.id) : [];

  // Determine root notebook and pre-fetch sub-pages
  const isSubPage = !!page.parentPageId;
  const rootPageId = isSubPage ? page.parentPageId! : pageId;

  const parentNotebookData = isSubPage
    ? (allPages.find((p) => p.id === page.parentPageId) ?? null)
    : null;
  const initialSubPages = await getSubPages(rootPageId, session.user.id);

  const parentNotebook = parentNotebookData as PageListItemTransport | null;

  // Writer feel (PLAN-11 §7): solo el arquetipo Writing. La "obra" es el folder al
  // que pertenece el capítulo; su progreso = suma de palabras de sus pages (derivado).
  const writer = system.templateType === "writing";
  // El medium de la obra gobierna nodos, slash menu, plantilla y export (W3, §6).
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
      page={toTransport(page)}
      systemId={systemId}
      systemName={system.name}
      allPages={toTransport(allPages)}
      breadcrumbItems={breadcrumbItems}
      parentNotebook={parentNotebook}
      initialSubPages={toTransport(initialSubPages)}
      writer={writer}
      obra={obra}
      obraMetadata={writer ? (folder?.metadata ?? null) : null}
      medium={medium}
    />
  );
}
