"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Files, Loader2 } from "lucide-react";
import { useFolders, useCreateFolder } from "@/features/folders/folders.hooks";
import { usePages } from "@/features/pages/pages.hooks";
import { CreatePageDialog } from "@/features/pages/CreatePageDialog";
import { DocsToolbar } from "./DocsToolbar";
import { FolderCard } from "./FolderCard";
import { PageCard } from "./PageCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface DocsViewProps {
  systemId: string;
}

export function DocsView({ systemId }: DocsViewProps) {
  const router = useRouter();
  const { data: folders = [], isLoading: foldersLoading } = useFolders(systemId);
  const { data: pages = [], isLoading: pagesLoading } = usePages(systemId);
  const { mutate: createFolder, isPending: creatingFolder } = useCreateFolder(systemId);

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

  const isLoading = foldersLoading || pagesLoading;
  const rootPages = pages.filter((p) => !p.folderId);
  const isEmpty = !isLoading && folders.length === 0 && rootPages.length === 0;

  function handleCreateFolder() {
    if (!folderName.trim()) return;
    createFolder({ name: folderName.trim() }, {
      onSuccess: () => {
        setFolderName("");
        setFolderDialogOpen(false);
      },
    });
  }

  return (
    <div className="w-full space-y-4">
      <DocsToolbar
        onNewFolder={() => setFolderDialogOpen(true)}
        onNewPage={() => setPageDialogOpen(true)}
      />

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg w-full" />
          ))}
        </div>
      )}

      {!isLoading && isEmpty && (
        <div className="rounded-lg border border-dashed p-10 text-center space-y-2">
          <Files className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">
            No documents yet. Create a folder or page to get started.
          </p>
        </div>
      )}

      {!isLoading && !isEmpty && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              systemId={systemId}
              onClick={() => router.push(`/systems/${systemId}/folders/${folder.id}`)}
            />
          ))}
          {rootPages.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              href={`/systems/${systemId}/pages/${page.id}`}
            />
          ))}
        </div>
      )}

      {/* Create folder dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                autoFocus
                placeholder="Folder name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
                maxLength={255}
              />
            </div>
            <Button onClick={handleCreateFolder} disabled={!folderName.trim() || creatingFolder}>
              {creatingFolder && <Loader2 className="size-4 animate-spin mr-2" />}
              {creatingFolder ? "Creating..." : "Create folder"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create page dialog — controlled */}
      <CreatePageDialog
        systemId={systemId}
        open={pageDialogOpen}
        onOpenChange={setPageDialogOpen}
      />
    </div>
  );
}
