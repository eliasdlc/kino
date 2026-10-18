"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { useFolderChildren, type FolderChildrenTransport } from "@/features/folders/folders.hooks";
import { api } from "@convex/_generated/api";
import { useConvexQuery } from "@/shared/convex/hooks";
import type { PageListTransport } from "@/features/pages/pages.hooks";
import { useSystemManifest } from "@/features/systems/systems.hooks";
import { capitalize } from "@/shared/lib/system-manifest";
import { FolderRow } from "./FolderRow";
import { FolderViewToolbar } from "./FolderViewToolbar";
import { IndexHead } from "./IndexHead";
import { NotebookRow } from "./NotebookRow";

interface FolderDocumentsProps {
  systemId: string;
  folderId: string;
  /** Lo que el servidor ya pintó; la suscripción toma el relevo. */
  initialChildren: FolderChildrenTransport;
  initialPages: PageListTransport;
  emptyCopy: { title: string; hint: string };
}

/**
 * Lo que contiene una carpeta, como índice: sus subcarpetas con numeral
 * romano y sus documentos numerados, bajo un título que lleva las dos
 * acciones de crear.
 *
 * Se suscribe en vez de vivir de las props del servidor porque renombrar una
 * página desde su fila dejaba el nombre viejo hasta recargar: el servidor
 * había pintado una foto y nadie la revalidaba. El render del servidor entra
 * como `initialData`, así que no hay parpadeo. La lista del servidor ya viene
 * filtrada por esta carpeta, y la suscripción pide lo mismo: `usePages` del
 * sistema entero leía todos sus documentos para enseñar los de una carpeta.
 */
export function FolderDocuments({
  systemId,
  folderId,
  initialChildren,
  initialPages,
  emptyCopy,
}: FolderDocumentsProps) {
  const manifest = useSystemManifest(systemId);
  const { data: children = [] } = useFolderChildren(folderId, initialChildren);
  // Los mismos argumentos que la lectura del servidor: así su foto sirve de
  // `initialData` y la suscripción sólo lee los documentos de esta carpeta.
  const { data } = useConvexQuery(api.pages.bySystem, { systemId, folderId }, { initialData: initialPages });
  const pages = data?.items ?? [];
  const folderPages = pages.filter((page) => page.folderId === folderId && !page.parentPageId);
  const hasContent = children.length > 0 || folderPages.length > 0;

  return (
    <section aria-labelledby={`${folderId}-contenido`}>
      <IndexHead
        id={`${folderId}-contenido`}
        title={capitalize(manifest.pageRole.nounPlural)}
        trailing={<FolderViewToolbar systemId={systemId} folderId={folderId} />}
      />

      {!hasContent ? (
        <EmptyState className="pl-(--margen)" title={emptyCopy.title} description={emptyCopy.hint} />
      ) : (
        <div>
          {children.map((child, i) => (
            <FolderRow
              key={child.id}
              index={i + 1}
              folder={child}
              systemId={systemId}
              href={`/systems/${systemId}/folders/${child.id}`}
            />
          ))}
          {folderPages.map((page, i) => (
            <NotebookRow
              key={page.id}
              index={i + 1}
              page={page}
              systemId={systemId}
              href={`/systems/${systemId}/pages/${page.id}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
