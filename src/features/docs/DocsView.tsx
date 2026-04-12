"use client";

import { Files } from "lucide-react";
import { useFolders } from "@/features/folders/folders.hooks";
import { DocsToolbar } from "./DocsToolbar";
import { FolderCard } from "./FolderCard";
import { PageCard } from "./PageCard";
import type { PageListItem } from "./docs.types";

// TODO(pages-types): Cambiar el import de arriba por:
// import type { PageListItem } from "@/features/pages/pages.types";

interface DocsViewProps {
  systemId: string;
}

export function DocsView({ systemId }: DocsViewProps) {
  const { data: folders = [], isLoading } = useFolders(systemId);

  // TODO(pages-hook): Reemplazar estas dos líneas por:
  // const { data: pages = [], isLoading: pagesLoading } = usePages(systemId);
  // Requiere crear src/features/pages/pages.hooks.ts con usePages(systemId).
  // Recordar también ajustar: isLoading → foldersLoading || pagesLoading
  const pages: PageListItem[] = [];

  // TODO(create-folder): Agregar estado y handler para el dialog de carpeta:
  // const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  // Luego pasar onNewFolder={() => setFolderDialogOpen(true)} a DocsToolbar
  // y renderizar <CreateFolderDialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen} systemId={systemId} />

  // TODO(create-page): Agregar estado y handler para el dialog de página:
  // const [pageDialogOpen, setPageDialogOpen] = useState(false)
  // Luego pasar onNewPage={() => setPageDialogOpen(true)} a DocsToolbar
  // y renderizar <CreatePageDialog open={pageDialogOpen} onOpenChange={setPageDialogOpen} systemId={systemId} />

  const isEmpty = !isLoading && folders.length === 0 && pages.length === 0;

  return (
    <div className="w-full space-y-4">
      <DocsToolbar />

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg border bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && isEmpty && (
        <div className="rounded-lg border border-dashed p-10 text-center space-y-2">
          <Files className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">
            No documents. Create a folder or page to get started.
          </p>
        </div>
      )}

      {!isLoading && !isEmpty && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {folders.map((folder) => (
            // TODO(folder-navigation): Pasar onClick={() => router.push(`/systems/${systemId}/folders/${folder.id}`)}
            // o convertir FolderCard en un Link cuando exista la ruta de carpeta
            <FolderCard key={folder.id} folder={folder} />
          ))}
          {pages.map((page) => (
            // TODO(page-editor): Pasar onClick={() => router.push(`/systems/${systemId}/pages/${page.id}`)}
            // o convertir PageCard en un Link cuando exista la ruta de editor
            <PageCard key={page.id} page={page} />
          ))}
        </div>
      )}
    </div>
  );
}
