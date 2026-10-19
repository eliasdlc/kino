"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { useRowManifest } from "@/features/systems/systems.hooks";
import type { ArchetypeManifest } from "@/shared/lib/system-types";

interface FolderViewToolbarProps {
  systemId: string;
  /** El vocabulario que la carpeta ya tiene: las acciones salen completas desde el primer render. */
  manifest?: ArchetypeManifest;
  folderId: string;
}

/**
 * Crear dentro de un contenedor, dicho en el título de su índice como dos
 * acciones con nombre. Los sustantivos salen del manifiesto del
 * arquetipo, nunca escritos a mano: en un sistema académico esto ofrece una
 * clase y un apunte, no una subcarpeta y un notebook.
 */
export function FolderViewToolbar({ systemId, folderId, manifest: manifestProp }: FolderViewToolbarProps) {
  const router = useRouter();
  const manifest = useRowManifest(systemId, manifestProp);
  const folderRole = manifest.folderRole;
  const pageRole = manifest.pageRole;
  // Un arquetipo cuyo contenedor no se anida no ofrece crear otro aquí dentro.
  // Dentro de una obra o un área lo que se crea es una parte de ella, no otra
  // obra: "Nueva obra" dentro de una obra se leía como una obra hermana.
  const subfolderLabel = folderRole && folderRole.nests !== false ? "Nueva parte" : null;
  const pageLabel = `${pageRole.gender === "f" ? "Nueva" : "Nuevo"} ${pageRole.noun}`;
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const { mutate: createFolder, isPending } = useCreateFolder(systemId);
  const { mutateAsync: createPage, isPending: creatingPage } = useCreatePage(systemId);

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
      <span className="flex flex-wrap items-center justify-end gap-x-1">
        {subfolderLabel && (
          <Button variant="link" size="sm" className="px-1" onClick={() => setFolderDialogOpen(true)}>
            {subfolderLabel}
          </Button>
        )}
        <Button variant="link" size="sm" className="px-1" disabled={creatingPage} onClick={handleCreateNotebook}>
          {creatingPage ? "Creando" : pageLabel}
        </Button>
      </span>

      <ResponsiveDialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{subfolderLabel ?? "Nueva carpeta"}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <form
            className="flex flex-col gap-4 pt-1"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateFolder();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="subfolder-name">Nombre</Label>
              <Input
                id="subfolder-name"
                autoFocus
                placeholder={folderRole?.placeholder ?? "Nombre"}
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                maxLength={255}
              />
            </div>
            <Button type="submit" disabled={!folderName.trim() || isPending}>
              {isPending ? "Creando" : "Crear parte"}
            </Button>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
