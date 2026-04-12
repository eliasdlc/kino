"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSubtasks, useToggleTask, useDeleteTask } from "./tasks.hooks";

interface SubtaskListProps {
  parentTaskId: string;
  systemId: string;
}

export function SubtaskList({ parentTaskId, systemId }: SubtaskListProps) {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const { data: subtasks, isLoading } = useSubtasks(parentTaskId, systemId, { enabled: true });
  const { mutate: toggleTask } = useToggleTask(systemId);
  const { mutate: deleteTask } = useDeleteTask(systemId);

  const subtaskQueryKey = ["tasks", systemId, "subtasks", parentTaskId];

  if (isLoading) {
    return <p className="text-xs text-muted-foreground pl-4 py-1">Loading...</p>;
  }

  if (!subtasks || subtasks.length === 0) {
    return <p className="text-xs text-muted-foreground pl-4 py-1">No subtasks.</p>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {subtasks.map((subtask) => {
        const isDone = subtask.status === "done";

        return (
          <div
            key={subtask.id}
            className="group flex items-center gap-2 pl-4 py-1 border-l ml-2"
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
                "size-3 shrink-0 rounded-full border-2 transition-colors",
                isDone
                  ? "border-green-500 bg-green-500"
                  : "border-muted-foreground/40 hover:border-primary"
              )}
            />
            <span
              className={cn(
                "text-xs flex-1 truncate",
                isDone && "line-through text-muted-foreground"
              )}
            >
              {subtask.title}
            </span>
            <button
              type="button"
              onClick={() => setDeleteTarget({ id: subtask.id, title: subtask.title })}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              aria-label="Delete subtask"
            >
              <Trash2 size={11} />
            </button>
          </div>
        );
      })}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete subtask"
        description={`"${deleteTarget?.title}" will be permanently deleted.`}
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
