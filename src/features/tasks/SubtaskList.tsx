"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSubtasks, useToggleTask, useDeleteTaskWithUndo, useCreateTask, taskKeys } from "./tasks.hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";

interface SubtaskListProps {
  parentTaskId: string;
  systemId: string;
}

export function SubtaskList({ parentTaskId, systemId }: SubtaskListProps) {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: subtasks, isLoading } = useSubtasks(parentTaskId, systemId, { enabled: true });
  const { mutate: toggleTask } = useToggleTask(systemId);
  const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId);
  const { mutate: createTask } = useCreateTask(systemId);

  const subtaskQueryKey = taskKeys.subtasks(parentTaskId);

  function handleAddSubtask() {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    inputRef.current?.focus();
    createTask(
      { title, parentTaskId, systemId },
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
        placeholder="Add subtask..."

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
            <button
              type="button"
              onClick={() =>
                toggleTask(subtask.id, {
                  onSuccess: () => queryClient.invalidateQueries({ queryKey: subtaskQueryKey }),
                })
              }
              aria-label={isDone ? "Mark as pending" : "Mark as completed"}
              className={cn(
                "size-4 shrink-0 rounded-full border-2 transition-colors",
                isDone
                  ? "border-green-500 bg-green-500"
                  : "border-muted-foreground/40 hover:border-primary"
              )}
            />
            <span
              className={cn(
                "text-sm flex-1 truncate",
                isDone && "line-through text-muted-foreground"
              )}
            >
              {subtask.title}
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ id: subtask.id, title: subtask.title })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    aria-label="Delete subtask"
                  >
                    <Trash2 size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Delete subtask</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      })}

      {addInput}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Move to trash"
        description={`"${deleteTarget?.title}" will be moved to the trash.`}
        confirmLabel="Move to trash"
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
    </div>
  );
}
