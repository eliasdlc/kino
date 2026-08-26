"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSubtasks, useToggleTask, useDeleteTaskWithUndo, useCreateTask, taskKeys } from "./tasks.hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { parseQuickInput } from "./quick-date-parse";
import { parseDueDate } from "./tasks.utils";
import type { TaskTransport } from "./tasks.types";

const ENERGY_DOT: Record<string, string> = {
  high: "bg-amber-400",
  medium: "bg-sky-400",
  low: "bg-zinc-400",
};

interface SubtaskListProps {
  parentTaskId: string;
  systemId: string;
}

export function SubtaskList({ parentTaskId, systemId }: SubtaskListProps) {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [editingSubtask, setEditingSubtask] = useState<TaskTransport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: subtasks, isLoading } = useSubtasks(parentTaskId, systemId, { enabled: true });
  const { mutate: toggleTask } = useToggleTask(systemId);
  const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId);
  const { mutate: createTask } = useCreateTask(systemId);

  const subtaskQueryKey = taskKeys.subtasks(parentTaskId);

  function handleAddSubtask() {
    const raw = newTitle.trim();
    if (!raw) return;
    setNewTitle("");
    inputRef.current?.focus();

    // KIN-76: extract date/priority via NL parser if tokens are present
    const parsed = parseQuickInput(raw);
    const title = parsed?.title || raw;
    const dueDate = parsed?.dueDate;
    const priority = parsed?.priority;

    createTask(
      {
        title,
        parentTaskId,
        systemId,
        ...(dueDate && { dueDate }),
        ...(priority && { priority }),
      },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: subtaskQueryKey }) }
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5 pl-4 py-1 ml-2">
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-4 w-[60%]" />
      </div>
    );
  }

  const addInput = (
    <div className="flex items-center gap-2 mt-1 pl-4 ml-2">
      <Plus size={14} className="shrink-0 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") handleAddSubtask();
          if (e.key === "Escape") setNewTitle("");
        }}
        placeholder="Agregar subtarea... (acepta mañana, !2, 1h)"
        className="h-7 p-2 text-sm border-none shadow-none focus-visible:ring-0 bg-transparent"
      />
    </div>
  );

  if (!subtasks || subtasks.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        {addInput}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {subtasks.map((subtask) => {
        const isDone = subtask.status === "done";

        return (
          <div
            key={subtask.id}
            className="group flex items-center gap-2.5 pl-4 py-1.5 border-l ml-2"
          >
            {/* KIN-74: toggle */}
            <button
              type="button"
              onClick={() =>
                toggleTask(subtask.id, {
                  onSuccess: () => queryClient.invalidateQueries({ queryKey: subtaskQueryKey }),
                })
              }
              aria-label={isDone ? "Marcar como pendiente" : "Marcar como completada"}
              className={cn(
                "size-4 shrink-0 rounded-full border-2 transition-colors",
                isDone
                  ? "border-green-500 bg-green-500"
                  : "border-muted-foreground/40 hover:border-primary"
              )}
            />

            {/* KIN-75: title clickable → opens TaskDetailSheet */}
            <button
              type="button"
              onClick={() => setEditingSubtask(subtask)}
              className={cn(
                "text-sm flex-1 min-w-0 truncate text-left hover:text-zinc-100 transition-colors",
                isDone && "line-through text-muted-foreground"
              )}
            >
              {subtask.title}
            </button>

            {/* KIN-74: show dueDate chip if present */}
            {subtask.dueDate && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-zinc-500 shrink-0">
                <Calendar size={11} />
                {format(parseDueDate(subtask.dueDate), "MMM d")}
              </span>
            )}

            {/* KIN-74: show energy dot if present */}
            {subtask.energyLevel && (
              <span
                className={cn("size-1.5 rounded-full shrink-0", ENERGY_DOT[subtask.energyLevel])}
                title={`Energía ${subtask.energyLevel}`}
              />
            )}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ id: subtask.id, title: subtask.title })}
                    className="md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    aria-label="Eliminar subtarea"
                  >
                    <Trash2 size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Eliminar subtarea</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      })}

      {addInput}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Mover a la papelera"
        description={`"${deleteTarget?.title}" se moverá a la papelera.`}
        confirmLabel="Mover a la papelera"
        onConfirm={() => {
          if (deleteTarget) {
            deleteTask(deleteTarget.id, {
              onSuccess: () => queryClient.invalidateQueries({ queryKey: subtaskQueryKey }),
            });
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* KIN-75: detail sheet para editar una subtarea */}
      <TaskDetailSheet
        task={editingSubtask}
        systemId={systemId}
        open={editingSubtask !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSubtask(null);
            queryClient.invalidateQueries({ queryKey: subtaskQueryKey });
          }
        }}
      />
    </div>
  );
}
