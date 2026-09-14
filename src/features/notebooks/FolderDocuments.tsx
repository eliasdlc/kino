"use client";

import { Files } from "lucide-react";
import { useFolderChildren, type FolderChildrenTransport } from "@/features/folders/folders.hooks";
import { usePages, type PageListTransport } from "@/features/pages/pages.hooks";
import { FolderCard } from "./FolderCard";
import { NotebookCard } from "./NotebookCard";
import { FolderViewToolbar } from "./FolderViewToolbar";

interface FolderDocumentsProps {
  systemId: string;
  folderId: string;
  /** Lo que el servidor ya pintó; la suscripción toma el relevo. */
  initialChildren: FolderChildrenTransport;
  initialPages: PageListTransport;
  emptyCopy: { title: string; hint: string };
}

/**
 * Lo que contiene una carpeta: sus subcarpetas y sus páginas.
 *
 * Se suscribe en vez de vivir de las props del servidor porque renombrar una
 * página desde su tarjeta dejaba el nombre viejo hasta recargar: el servidor
 * había pintado una foto y nadie la revalidaba. El render del servidor entra
 * como `initialData`, así que no hay parpadeo.
 */
export function FolderDocuments({
  systemId,
  folderId,
  initialChildren,
  initialPages,
  emptyCopy,
}: FolderDocumentsProps) {
  const { data: children = [] } = useFolderChildren(folderId, initialChildren);
  const { data: pages = [] } = usePages(systemId, initialPages);
  const folderPages = pages.filter((page) => page.folderId === folderId && !page.parentPageId);
  const hasContent = children.length > 0 || folderPages.length > 0;

  return (
    <>
      <FolderViewToolbar systemId={systemId} folderId={folderId} />

      {!hasContent ? (
        <div className="rounded-lg border border-dashed p-10 text-center space-y-2">
          <Files className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium">{emptyCopy.title}</p>
          <p className="text-sm text-muted-foreground">{emptyCopy.hint}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {children.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {children.map((child) => (
                <FolderCard
                  key={child.id}
                  folder={child}
                  systemId={systemId}
                  href={`/systems/${systemId}/folders/${child.id}`}
                />
              ))}
            </div>
          )}
          {folderPages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {folderPages.map((page) => (
                <NotebookCard
                  key={page.id}
                  page={page}
                  systemId={systemId}
                  href={`/systems/${systemId}/pages/${page.id}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
