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
import { CreatePageDialog } from "@/features/pages/CreatePageDialog";

interface FolderViewToolbarProps {
  systemId: string;
  folderId: string;
}

export function FolderViewToolbar({ systemId, folderId }: FolderViewToolbarProps) {
  const router = useRouter();
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const { mutate: createFolder, isPending } = useCreateFolder(systemId);

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

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setFolderDialogOpen(true)}>
          <FolderPlus className="size-3.5" />
          Nueva subcarpeta
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPageDialogOpen(true)}>
          Nueva página
        </Button>
      </div>

      <ResponsiveDialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Nueva subcarpeta</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="subfolder-name">Nombre</Label>
              <Input
                id="subfolder-name"
                autoFocus
                placeholder="Nombre de la subcarpeta"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
                maxLength={255}
              />
            </div>
            <Button onClick={handleCreateFolder} disabled={!folderName.trim() || isPending}>
              {isPending ? "Creando..." : "Crear subcarpeta"}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <CreatePageDialog
        systemId={systemId}
        folderId={folderId}
        open={pageDialogOpen}
        onOpenChange={setPageDialogOpen}
      />
    </>
  );
}
