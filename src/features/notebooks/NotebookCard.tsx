"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeletePage, useUpdatePage } from "@/features/pages/pages.hooks";
import type { PageListItemTransport } from "@/features/pages/pages.types";

const TAG_PILL: Record<string, string> = {
  red: "bg-red-500/20 text-red-400",
  blue: "bg-blue-500/20 text-blue-400",
  pink: "bg-pink-500/20 text-pink-400",
  purple: "bg-purple-500/20 text-purple-400",
  green: "bg-green-500/20 text-green-400",
  orange: "bg-orange-500/20 text-orange-400",
  yellow: "bg-yellow-500/20 text-yellow-400",
  teal: "bg-teal-500/20 text-teal-400",
  gray: "bg-zinc-500/20 text-zinc-400",
  black: "bg-zinc-800/60 text-zinc-300",
  white: "bg-white/10 text-white/70",
};

interface NotebookCardProps {
  page: PageListItemTransport;
  systemId: string;
  href: string;
}

function formatNoteDate(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cardDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - cardDay.getTime()) / 86_400_000);

  if (diffDays === 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";

  return d
    .toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "2-digit",
    })
    .toUpperCase();
}

export function NotebookCard({ page, systemId, href }: NotebookCardProps) {
  const { mutate: deletePage } = useDeletePage(systemId);
  const { mutate: updatePage, isPending: isUpdating } = useUpdatePage(page.id, systemId);

  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newTitle, setNewTitle] = useState(page.title ?? "");

  function handleRename() {
    updatePage(
      { title: newTitle.trim() || undefined },
      { onSuccess: () => setRenameOpen(false) }
    );
  }

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <div className="aspect-square group relative">
      <Link
          href={href}
          className="flex flex-col h-full overflow-hidden rounded-2xl bg-card border border-border/40 p-5 hover:border-border/80 transition-colors"
        >
          {page.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {page.tags.map((tag) => (
                <span
                  key={tag.id}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${TAG_PILL[tag.color] ?? TAG_PILL.gray}`}
                >
                  {tag.title}
                </span>
              ))}
            </div>
          )}

          <h3 className="text-xl font-bold leading-tight text-foreground mb-2 line-clamp-2">
            {page.title ?? (
              <span className="text-muted-foreground font-normal italic">Untitled</span>
            )}
          </h3>

          {page.contentPreview && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {page.contentPreview}
            </p>
          )}

          <div className="flex items-center mt-auto pt-3 pr-7">
            <span className="text-[11px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
              {formatNoteDate(page.createdAt)}
            </span>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-3 right-3 size-6 rounded md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              aria-label={`Acciones de ${page.title ?? "la nota"}`}
              onClick={(e) => e.preventDefault()}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              className="gap-2"
              onClick={() => {
                setNewTitle(page.title ?? "");
                setRenameOpen(true);
              }}
            >
              <Pencil className="size-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
    </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36">
        <ContextMenuItem className="gap-2" onSelect={() => { setNewTitle(page.title ?? ""); setRenameOpen(true); }}>
          <Pencil className="size-3.5" /> Rename
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" className="gap-2" onSelect={() => setConfirmDelete(true)}>
          <Trash2 className="size-3.5" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

      <ResponsiveDialog open={renameOpen} onOpenChange={setRenameOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Renombrar notebook</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="notebook-rename">Título</Label>
              <Input
                id="notebook-rename"
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                }}
                maxLength={500}
              />
            </div>
            <Button onClick={handleRename} disabled={isUpdating}>
              {isUpdating && <Loader2 className="size-4 animate-spin mr-2" />}
              {isUpdating ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar notebook"
        description={`"${page.title ?? "Sin título"}" será eliminado permanentemente.`}
        onConfirm={() => {
          setConfirmDelete(false);
          deletePage(page.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
