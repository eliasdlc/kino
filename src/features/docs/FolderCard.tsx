"use client";

import { useState } from "react";
import Link from "next/link";
import { Folder, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { getSystemColor } from "@/shared/utils/system-colors";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateFolder, useDeleteFolder } from "@/features/folders/folders.hooks";
import type { FolderListItem } from "@/features/folders/folders.types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

interface FolderCardProps {
  folder: FolderListItem;
  systemId: string;
  onClick?: () => void;
  href?: string;
}

export function FolderCard({ folder, systemId, onClick, href }: FolderCardProps) {
  const cls = getSystemColor(folder.color);
  const { mutate: updateFolder, isPending: isUpdating } = useUpdateFolder(systemId);
  const { mutate: deleteFolder } = useDeleteFolder(systemId);

  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newName, setNewName] = useState(folder.name);

  function handleRename() {
    if (!newName.trim() || newName === folder.name) {
      setRenameOpen(false);
      return;
    }
    updateFolder(
      { folderId: folder.id, data: { name: newName.trim() } },
      { onSuccess: () => setRenameOpen(false) }
    );
  }

  return (
    <>
      <div className="group relative flex flex-col items-start gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-accent hover:border-accent-foreground/20">
        {href ? (
          <Link
            href={href}
            className="flex flex-col items-start gap-2 w-full text-left focus-visible:outline-none"
            aria-label={`Open folder ${folder.name}`}
          >
            <Folder className={`size-7 text-${cls}`} />
            <span className="text-sm font-medium truncate w-full leading-tight pr-6">
              {folder.name}
            </span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onClick}
            className="flex flex-col items-start gap-2 w-full text-left focus-visible:outline-none"
            aria-label={`Open folder ${folder.name}`}
          >
            <Folder className={`size-7 text-${cls}`} />
            <span className="text-sm font-medium truncate w-full leading-tight pr-6">
              {folder.name}
            </span>
          </button>
        )}

        {/* Context menu — shown on hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Folder options"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Folder options</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                className="gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewName(folder.name);
                  setRenameOpen(true);
                }}
              >
                <Pencil className="size-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
              >
                <Trash2 className="size-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="folder-rename">Name</Label>
              <Input
                id="folder-rename"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
                maxLength={255}
              />
            </div>
            <Button onClick={handleRename} disabled={!newName.trim() || isUpdating}>
              {isUpdating && <Loader2 className="size-4 animate-spin mr-2" />}
              {isUpdating ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete folder"
        description={`"${folder.name}" and all its contents will be permanently deleted.`}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteFolder(folder.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
