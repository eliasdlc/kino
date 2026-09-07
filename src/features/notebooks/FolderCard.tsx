"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, FileText, FolderClosed, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhysicalCard } from "@/components/PhysicalCard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateFolder, useDeleteFolder } from "@/features/folders/folders.hooks";
import type { FolderWithCounts } from "@/features/folders/folders.types";

interface FolderCardProps {
  folder: FolderWithCounts;
  systemId: string;
  onClick?: () => void;
  href?: string;
}

/** A sheet of "paper" that fans out of the folder from its bottom edge on hover. */
function PaperSheet({ className }: { className: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 origin-bottom rounded-md bg-white p-2 shadow-[0_2px_6px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out",
        className
      )}
    >
      <div className="h-[3px] w-3/5 rounded-full bg-zinc-200" />
      <div className="mt-1 h-[3px] w-4/5 rounded-full bg-zinc-200" />
      <div className="mt-1 h-[3px] w-[70%] rounded-full bg-zinc-200" />
    </div>
  );
}

export function FolderCard({ folder, systemId, onClick, href }: FolderCardProps) {
  const { mutate: updateFolder, isPending: isUpdating } = useUpdateFolder(systemId);
  const { mutate: deleteFolder } = useDeleteFolder(systemId);

  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newName, setNewName] = useState(folder.name);

  const hasContent = folder.subfolderCount + folder.pageCount > 0;

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
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
      <PhysicalCard
        href={href}
        onClick={onClick}
        ariaLabel={`Abrir carpeta ${folder.name}`}
        menu={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-full bg-background/70 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
                aria-label="Opciones de carpeta"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                className="gap-2"
                onClick={() => {
                  setNewName(folder.name);
                  setRenameOpen(true);
                }}
              >
                <Pencil className="size-3.5" />
                Renombrar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        {/* Folder back: solid neutral, floating inside a background-coloured outline */}
        <div className="absolute inset-0 rounded-[20px] bg-zinc-200 dark:bg-zinc-600 sm:rounded-[28px]">
          <div className="absolute inset-0 rounded-[20px] shadow-[inset_0_0_0_4px_var(--background)] sm:rounded-[28px] sm:shadow-[inset_0_0_0_5px_var(--background)]" />
        </div>

        {/* Papers: peek above the flap and fan out on hover */}
        {hasContent && (
          <div className="absolute left-1/2 top-[15%] z-(--z-raised) h-[42%] w-[54%] -translate-x-1/2">
            <PaperSheet className="group-hover:-translate-x-3 group-hover:-translate-y-1.5 group-hover:-rotate-[9deg]" />
            <PaperSheet className="group-hover:translate-x-3 group-hover:-translate-y-1.5 group-hover:rotate-[7deg]" />
            <PaperSheet className="translate-y-[3px] group-hover:-translate-y-2" />
          </div>
        )}

        {/* Folder front: tabbed flap sitting over the back (tab + shadow seam = the folder).
            Taller on mobile so a 2-line name + counts never collide on narrow phones. */}
        <div className="absolute inset-x-0 bottom-0 z-(--z-overlay) h-[58%] sm:h-[54%]">
          {/* tab sticking up on the left */}
          <div className="absolute bottom-full h-[16px] w-[42%] z-(--z-raised) translate-y-px rounded-t-[12px] bg-card shadow-[0_-4px_10px_-3px_rgba(0,0,0,0.25)] sm:h-[18px] sm:rounded-t-[20px]" />
          {/* flap face */}
          <div className="absolute inset-0 rounded-b-[20px] rounded-tr-[14px] border-t border-foreground/10 bg-card shadow-[0_-7px_18px_-4px_rgba(0,0,0,0.28)] sm:rounded-b-[28px]" />

          <div className="absolute inset-0 flex flex-col justify-between gap-1 p-2.5 sm:p-4">
            <h3 className="line-clamp-2 pr-1 text-[13px] font-semibold leading-snug text-foreground sm:text-sm">
              {folder.name}
            </h3>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="flex items-center gap-1" title={`${folder.subfolderCount} subcarpetas`}>
                <FolderClosed size={14} strokeWidth={2.2} />
                <span className="text-xs font-medium tabular-nums">{folder.subfolderCount}</span>
              </span>
              <span className="flex items-center gap-1" title={`${folder.pageCount} notebooks`}>
                <FileText size={14} strokeWidth={2.2} />
                <span className="text-xs font-medium tabular-nums">{folder.pageCount}</span>
              </span>
            </div>
          </div>
        </div>
      </PhysicalCard>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-36">
          <ContextMenuItem className="gap-2" onSelect={() => { setNewName(folder.name); setRenameOpen(true); }}>
            <Pencil className="size-3.5" /> Renombrar
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" className="gap-2" onSelect={() => setConfirmDelete(true)}>
            <Trash2 className="size-3.5" /> Eliminar
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Rename dialog */}
      <ResponsiveDialog open={renameOpen} onOpenChange={setRenameOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Renombrar carpeta</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="folder-rename">Nombre</Label>
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
              {isUpdating ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar carpeta"
        description={`"${folder.name}" y todo lo que contiene se eliminarán para siempre.`}
        onConfirm={() => {
          setConfirmDelete(false);
          deleteFolder(folder.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
