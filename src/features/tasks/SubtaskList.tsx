"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSubtasks, useToggleTask, useDeleteTaskWithUndo, taskKeys } from "./tasks.hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SubtaskListProps {
  parentTaskId: string;
  systemId: string;
}

export function SubtaskList({ parentTaskId, systemId }: SubtaskListProps) {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const { data: subtasks, isLoading } = useSubtasks(parentTaskId, systemId, { enabled: true });
  const { mutate: toggleTask } = useToggleTask(systemId);
  const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId);

  const subtaskQueryKey = taskKeys.subtasks(parentTaskId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5 pl-4 py-1 ml-2">
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-4 w-[60%]" />
      </div>
    );
  }

  if (!subtasks || subtasks.length === 0) {
    return <p className="text-xs text-muted-foreground pl-4 py-1">No subtasks.</p>;
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
