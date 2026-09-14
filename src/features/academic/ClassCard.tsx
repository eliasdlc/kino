"use client";

import { useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, startOfToday } from "date-fns";
import { CalendarClock, FileText, FolderSymlink, MoreHorizontal, Pencil, Trash2, User } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useDeleteFolder, useUpdateFolder } from "@/features/folders/folders.hooks";
import type { FolderWithCounts } from "@/features/folders/folders.types";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { parseDueDate } from "@/features/tasks/tasks.utils";
import { cn } from "@/lib/utils";
import { MoveToCycleDialog } from "./MoveToCycleMenu";
import type { AcademicPeriod } from "./academic.hooks";

interface ClassCardProps {
  folder: FolderWithCounts;
  systemId: string;
  tasks: TaskTransport[];
  periods: AcademicPeriod[];
  href: string;
}

/** Lo que falta por entregar en la clase, del más cercano al más lejano. */
function pending(tasks: TaskTransport[]) {
  return tasks.filter((task) => !task.deletedAt && task.status !== "done");
}

/** La entrega más próxima, en días desde hoy. `null` si ninguna tiene fecha. */
function nextDue(tasks: TaskTransport[]): { label: string; overdue: boolean } | null {
  const today = startOfToday();
  const dated = pending(tasks)
    .filter((task) => task.dueDate)
    .map((task) => differenceInCalendarDays(parseDueDate(task.dueDate as string), today))
    .sort((a, b) => a - b);
  if (dated.length === 0) return null;
  const days = dated[0];
  if (days < 0) return { label: days === -1 ? "vencida ayer" : `vencida hace ${Math.abs(days)} días`, overdue: true };
  if (days === 0) return { label: "entrega hoy", overdue: false };
  if (days === 1) return { label: "entrega mañana", overdue: false };
  return { label: `entrega en ${days} días`, overdue: false };
}

function metaString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Una clase en la rejilla de apuntes. No es una carpeta de papel: dice quién la
 * da, cuándo se ve y qué está por entregar, que es lo que decide a cuál entras.
 */
export function ClassCard({ folder, systemId, tasks, periods, href }: ClassCardProps) {
  const { mutate: updateFolder, isPending: isUpdating } = useUpdateFolder(systemId);
  const { mutate: deleteFolder } = useDeleteFolder(systemId);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moving, setMoving] = useState(false);
  const [newName, setNewName] = useState(folder.name);

  const professor = metaString(folder.metadata, "professor");
  const schedule = metaString(folder.metadata, "schedule");
  const open = pending(tasks).length;
  const due = nextDue(tasks);

  function handleRename() {
    if (!newName.trim() || newName === folder.name) {
      setRenameOpen(false);
      return;
    }
    updateFolder({ folderId: folder.id, data: { name: newName.trim() } }, { onSuccess: () => setRenameOpen(false) });
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="group relative">
            <Link
              href={href}
              className="flex h-full min-h-[7.5rem] flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <h3 className="line-clamp-2 pr-8 text-[1.02rem] font-semibold leading-snug">{folder.name}</h3>

              {(professor || schedule) && (
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {professor && (
                    <span className="flex items-center gap-1.5">
                      <User className="size-3.5 shrink-0" />
                      <span className="truncate">{professor}</span>
                    </span>
                  )}
                  {schedule && (
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="size-3.5 shrink-0" />
                      <span className="truncate">{schedule}</span>
                    </span>
                  )}
                </div>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <FileText className="size-3.5" />
                  <span className="tabular-nums">{folder.pageCount}</span>
                </span>
                <span className="text-muted-foreground">
                  {open} pendiente{open === 1 ? "" : "s"}
                </span>
                {due && (
                  <span className={cn("font-medium", due.overdue ? "text-task-overdue" : "text-foreground")}>
                    {due.label}
                  </span>
                )}
              </div>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Opciones de ${folder.name}`}
                  className="absolute right-2 top-2 size-8 rounded-full text-muted-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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
                <DropdownMenuItem className="gap-2" onClick={() => setMoving(true)}>
                  <FolderSymlink className="size-3.5" />
                  Mover a ciclo
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
        <ContextMenuContent className="w-48">
          <ContextMenuItem
            className="gap-2"
            onSelect={() => {
              setNewName(folder.name);
              setRenameOpen(true);
            }}
          >
            <Pencil className="size-3.5" /> Renombrar
          </ContextMenuItem>
          <ContextMenuItem className="gap-2" onSelect={() => setMoving(true)}>
            <FolderSymlink className="size-3.5" /> Mover a ciclo
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
            <ResponsiveDialogTitle>Renombrar clase</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor={`class-rename-${folder.id}`}>Nombre</Label>
              <Input
                id={`class-rename-${folder.id}`}
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleRename();
                }}
                maxLength={255}
              />
            </div>
            <Button onClick={handleRename} disabled={!newName.trim() || isUpdating}>
              Guardar
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <MoveToCycleDialog folder={folder} periods={periods} open={moving} onOpenChange={setMoving} />

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar clase"
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
