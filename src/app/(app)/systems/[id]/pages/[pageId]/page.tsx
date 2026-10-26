import { cn } from "@/lib/utils";
import { notFound, redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import type { BreadcrumbItem } from "@/components/PageBreadcrumb";
import { NotebookEditorLayout } from "@/features/pages/NotebookEditorLayout";
import { MEDIUM_CONFIG, resolveMedium } from "@/shared/lib/mediums";
import { SanitizedHtml } from "@/shared/components/SanitizedHtml";
import { getServerSession } from "@/shared/utils/session";

interface PageEditorRouteProps {
  params: Promise<{ id: string; pageId: string }>;
  searchParams: Promise<{ cycle?: string }>;
}

export default async function PageEditorRoute({ params, searchParams }: PageEditorRouteProps) {
  const { id: systemId, pageId } = await params;
  const { cycle } = await searchParams;
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
  const [folder, parentNotebook, initialSubPages, allPages, fichasDelCodex] = await Promise.all([
    page.folderId ? serverQuery(api.folders.detail, { id: page.folderId }) : null,
    page.parentPageId ? serverQuery(api.pages.byId, { id: page.parentPageId }) : null,
    serverQuery(api.pages.subpages, { id: rootPageId }),
    writer && page.folderId
      ? serverQuery(api.pages.bySystem, { systemId, folderId: page.folderId }).then((result) => result.items)
      : [],
    // Las fichas del codex que nombra el capítulo: su fila va encima del texto,
    // y la primera pintura le guarda el sitio para que el texto no baje.
    writer
      ? serverQuery(api.entities.byPage, { pageId }).then((rows) => rows.length).catch(() => 0)
      : 0,
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

  // Volver al sistema devuelve a los documentos, que es de donde se entra a un
  // apunte, y con el mismo ciclo.
  const systemHref = `/systems/${systemId}?tab=docs${cycle ? `&cycle=${encodeURIComponent(cycle)}` : ""}`;

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Sistemas", href: "/systems" },
    { label: system.name, href: systemHref },
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
      breadcrumbItems={breadcrumbItems}
      parentNotebook={parentNotebook ? { id: parentNotebook.id, title: parentNotebook.title } : null}
      initialSubPages={initialSubPages}
      writer={writer}
      obra={obra}
      obraMetadata={writer ? (folder?.metadata ?? null) : null}
      medium={medium}
      fichasDelCodex={fichasDelCodex}
      firstPaint={
        // El texto se sanea y se pinta aquí, en el servidor: llega en la primera
        // pintura con la clase del editor, sin esperar al chunk de Tiptap y sin
        // mandar al navegador la librería del saneo. Lleva también lo que el
        // CSS de ProseMirror le pone al editor al crearlo (espacios que se
        // conservan, sin ligaduras): sin eso las líneas cortan en otra palabra
        // y el texto se recoloca al llegar el editor. El editor envuelve el
        // texto de cada elemento de lista en un párrafo, que en un manuscrito
        // va justificado; el HTML guardado a veces no lo trae, así que en un
        // manuscrito la lista se justifica aquí también.
        <SanitizedHtml
          html={page.content}
          className={cn(
            "tiptap ProseMirror min-h-[60vh] text-sm leading-7 break-words whitespace-break-spaces [font-feature-settings:'liga'_0] [font-variant-ligatures:none]",
            writer && "[&_li]:text-justify",
          )}
        />
      }
    />
  );
}
