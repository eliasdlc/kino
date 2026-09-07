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

  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "ayer";

  return d.toLocaleDateString("es", { day: "numeric", month: "short" }).replace(".", "");
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
    <div className="group relative">
      <Link
          href={href}
          className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-(--shadow) transition-colors hover:bg-accent/40"
        >
          {page.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {page.tags.map((tag) => (
                <span
                  key={tag.id}
                  className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${TAG_PILL[tag.color] ?? TAG_PILL.gray}`}
                >
                  {tag.title}
                </span>
              ))}
            </div>
          )}

          <h3 className="mb-1 line-clamp-2 text-[1.06rem] font-bold leading-snug tracking-[-0.01em] text-foreground">
            {page.title ?? <span className="font-normal text-muted-foreground">Sin título</span>}
          </h3>

          {page.contentPreview && (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {page.contentPreview}
            </p>
          )}

          <div className="mt-3 flex items-center pr-8">
            <span className="text-xs text-muted-foreground">{formatNoteDate(page.createdAt)}</span>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute right-2 bottom-2 md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
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
    </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36">
        <ContextMenuItem className="gap-2" onSelect={() => { setNewTitle(page.title ?? ""); setRenameOpen(true); }}>
          <Pencil className="size-3.5" /> Renombrar
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" className="gap-2" onSelect={() => setConfirmDelete(true)}>
          <Trash2 className="size-3.5" /> Eliminar
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
        description={`"${page.title ?? "Sin título"}" se eliminará para siempre.`}
        onConfirm={() => {
          setConfirmDelete(false);
          deletePage(page.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
