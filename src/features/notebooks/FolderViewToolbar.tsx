"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateFolder } from "@/features/folders/folders.hooks";
import { useCreatePage } from "@/features/pages/pages.hooks";
import { useSystemManifest } from "@/features/systems/systems.hooks";

interface FolderViewToolbarProps {
  systemId: string;
  folderId: string;
}

/**
 * Crear dentro de un contenedor. Los sustantivos salen del manifiesto del
 * arquetipo, nunca escritos a mano: en un sistema académico esto ofrece una
 * clase y un apunte, no una subcarpeta y un notebook.
 */
export function FolderViewToolbar({ systemId, folderId }: FolderViewToolbarProps) {
  const router = useRouter();
  const manifest = useSystemManifest(systemId);
  const folderRole = manifest.folderRole;
  const pageRole = manifest.pageRole;
  // Un arquetipo cuyo contenedor no se anida no ofrece crear otro aquí dentro.
  const subfolderLabel =
    folderRole && folderRole.nests !== false ? `${folderRole.gender === "f" ? "Nueva" : "Nuevo"} ${folderRole.noun}` : null;
  const pageLabel = `${pageRole.gender === "f" ? "Nueva" : "Nuevo"} ${pageRole.noun}`;
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const { mutate: createFolder, isPending } = useCreateFolder(systemId);
  const { mutateAsync: createPage } = useCreatePage(systemId);

  function handleCreateFolder() {
    if (!folderName.trim()) return;
    createFolder(
      { name: folderName.trim(), parentId: folderId },
      {
        onSuccess: (created) => {
          setFolderName("");
          setFolderDialogOpen(false);
          router.push(`/systems/${systemId}/folders/${created.id}`);
        },
      }
    );
  }

  async function handleCreateNotebook() {
    const page = await createPage({ folderId });
    router.push(`/systems/${systemId}/pages/${page.id}`);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {subfolderLabel && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setFolderDialogOpen(true)}>
            <FolderPlus className="size-3.5" />
            {subfolderLabel}
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCreateNotebook}>
          {pageLabel}
        </Button>
      </div>

      <ResponsiveDialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{subfolderLabel ?? "Nueva carpeta"}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="subfolder-name">Nombre</Label>
              <Input
                id="subfolder-name"
                autoFocus
                placeholder={folderRole?.placeholder ?? "Nombre de la carpeta"}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
                maxLength={255}
              />
            </div>
            <Button onClick={handleCreateFolder} disabled={!folderName.trim() || isPending}>
              {isPending ? "Creando..." : `Crear ${folderRole?.noun ?? "carpeta"}`}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
