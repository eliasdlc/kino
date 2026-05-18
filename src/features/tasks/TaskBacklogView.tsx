import { useState } from "react";
import type { Task } from "./tasks.types";
import { useTasks, useFolderTasks, useToggleTask, useDeleteTask } from "./tasks.hooks";
import { TaskCard } from "./TaskCard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTaskKeyboardNavigation } from "./useTaskKeyboardNavigation";

interface TaskBacklogViewProps {
    systemId: string;
    initialData: Task[];
    folderId?: string;
    onEdit?: (task: Task) => void;
    keyboardDisabled?: boolean;
}

/**
 * Backlog tab — shows tasks without a startDate (status = "backlog").
 * These are ideas / brain dumps that haven't been scheduled yet.
 */
export function TaskBacklogView({ systemId, initialData, folderId, onEdit, keyboardDisabled }: TaskBacklogViewProps) {
    // Use folder-scoped or system-scoped tasks depending on context
    const systemQuery = useTasks(systemId, initialData);
    const folderQuery = useFolderTasks(systemId, folderId ?? "");
    const { data: tasks = [] } = folderId ? folderQuery : systemQuery;

    const { mutate: toggleTask } = useToggleTask(systemId, folderId);
    const { mutate: deleteTask } = useDeleteTask(systemId, folderId);

    const backlogTasks = tasks.filter((t) => t.status === "backlog");

    const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

    const { focusedTaskId } = useTaskKeyboardNavigation(backlogTasks, {
        onSelect: onEdit,
        onToggle: toggleTask,
        onDelete: setDeleteTarget,
    }, {
        enabled: !keyboardDisabled && deleteTarget === null
    });

    return (
        <div className="flex flex-col gap-4 w-full h-full">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold">Backlog</h2>
                <p className="text-sm text-muted-foreground">
                    Unscheduled tasks. Assign a date to move them to the planning board.
                </p>
            </div>
            {backlogTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                    No backlog tasks. All your tasks have dates assigned.
                </p>
            ) : (
                <div className="flex flex-col gap-2.5 w-full">
                    {backlogTasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            systemId={systemId}
                            isFocused={task.id === focusedTaskId}
                            onToggle={(id) => toggleTask(id)}
                            onDelete={() => setDeleteTarget(task)}
                            onEdit={onEdit}
                        />
                    ))}
                </div>
            )}

            <ConfirmDialog
              open={deleteTarget !== null}
              title="Delete task"
              description={`"${deleteTarget?.title}" will be permanently deleted.`}
              onConfirm={() => {
                if (deleteTarget) deleteTask(deleteTarget.id);
                setDeleteTarget(null);
              }}
              onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
