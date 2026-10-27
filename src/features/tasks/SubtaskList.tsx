"use client";

import { useRef, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubtasks, useToggleTask, useDeleteTaskWithUndo, useCreateTask } from "./tasks.hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskDetailSheet } from "./TaskDetailSheet";
import { parseQuickInput } from "./quick-date-parse";
import { dueMeta } from "./task-vocab";
import type { TaskTransport } from "./tasks.types";

interface SubtaskListProps {
  parentTaskId: string;
  systemId: string;
}

/**
 * Las subtareas de una tarea: cada una con su círculo de 48 px, su título (que
 * abre su propio detalle), su fecha en español y la papelera, también de 48
 * px; con ratón la papelera aparece al pasar. Borrar no pregunta: el aviso
 * trae Deshacer. El campo de abajo agrega otra y entiende "mañana", "!2" o
 * "1h".
 */
export function SubtaskList({ parentTaskId, systemId }: SubtaskListProps) {
  const [newTitle, setNewTitle] = useState("");
  const [editingSubtask, setEditingSubtask] = useState<TaskTransport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: subtasks, isLoading } = useSubtasks(parentTaskId, systemId, { enabled: true });
  const { mutate: toggleTask } = useToggleTask(systemId);
  const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId);
  const { mutate: createTask } = useCreateTask(systemId);

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
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5 py-2">
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-4 w-[60%]" />
      </div>
    );
  }

  const addInput = (
    <label className="flex min-h-[2.85rem] items-center gap-1">
      <span className="flex size-[2.85rem] shrink-0 items-center justify-center text-muted-foreground md:pointer-fine:size-8" aria-hidden>
        <Plus className="size-4" />
      </span>
      <span className="sr-only">Agregar subtarea</span>
      <input
        ref={inputRef}
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") handleAddSubtask();
          if (e.key === "Escape") setNewTitle("");
        }}
        placeholder="Otra subtarea (entiende mañana, !2, 1h)"
        className="focus-ring min-h-[2.85rem] min-w-0 flex-1 rounded-md bg-transparent text-base outline-none placeholder:text-muted-foreground"
      />
    </label>
  );

  if (!subtasks || subtasks.length === 0) {
    return (
      <div className="flex flex-col">
        {addInput}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {subtasks.map((subtask) => {
        const isDone = subtask.status === "done";

        return (
          <div key={subtask.id} className="group flex min-h-[2.85rem] items-center gap-1 border-b border-border">
            <button
              type="button"
              onClick={() => toggleTask(subtask.id)}
              aria-label={`Completar ${subtask.title}`}
              aria-pressed={isDone}
              className="press focus-ring flex size-[2.85rem] shrink-0 items-center justify-center rounded-full transition-transform duration-(--dur-toque) ease-(--ease-pluma) md:pointer-fine:size-8"
            >
              <span
                className={cn(
                  "flex size-[1.1rem] items-center justify-center rounded-full border-[1.6px] transition-[background-color,border-color] duration-(--dur-tachar) ease-(--ease-pluma)",
                  isDone ? "border-task-done bg-task-done text-task-done-foreground" : "border-input group-hover:border-foreground/60",
                )}
                aria-hidden
              >
                {isDone && <Check className="size-2.5" strokeWidth={3} />}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setEditingSubtask(subtask)}
              className={cn(
                "focus-ring min-h-[2.85rem] min-w-0 flex-1 truncate rounded-md text-left text-base transition-colors duration-(--dur-toque) ease-(--ease-pluma) hover:text-muted-foreground",
                isDone && "text-muted-foreground line-through decoration-input",
              )}
            >
              {subtask.title}
            </button>

            {subtask.dueDate && (
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{dueMeta(subtask.dueDate, isDone).when}</span>
            )}

            <button
              type="button"
              onClick={() => deleteTask(subtask.id)}
              className="focus-ring flex size-[2.85rem] shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[color,opacity] duration-(--dur-toque) ease-(--ease-pluma) hover:text-destructive md:pointer-fine:size-8 md:pointer-fine:opacity-0 md:pointer-fine:group-hover:opacity-100 md:pointer-fine:focus-visible:opacity-100"
              aria-label={`Mover a la papelera ${subtask.title}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        );
      })}

      {addInput}

      {/* KIN-75: detail sheet para editar una subtarea */}
      <TaskDetailSheet
        task={editingSubtask}
        systemId={systemId}
        open={editingSubtask !== null}
        onOpenChange={(open) => {
          if (!open) setEditingSubtask(null);
        }}
      />
    </div>
  );
}
