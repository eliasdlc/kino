import { useState } from "react";
import type { Task } from "./tasks.types";
import { useTasks, useFolderTasks, useToggleTask, useDeleteTaskWithUndo } from "./tasks.hooks";
import { TaskCard } from "./TaskCard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTaskKeyboardNavigation } from "./useTaskKeyboardNavigation";

interface TaskBacklogViewProps {
    systemId: string;
    initialData: Task[];
    folderId?: string;
    folderInitialData?: Task[];
    onEdit?: (task: Task) => void;
    keyboardDisabled?: boolean;
}

/**
 * Backlog tab — shows tasks without a startDate (status = "backlog").
 * These are ideas / brain dumps that haven't been scheduled yet.
 */
export function TaskBacklogView({ systemId, initialData, folderId, folderInitialData, onEdit, keyboardDisabled }: TaskBacklogViewProps) {
    // Use folder-scoped or system-scoped tasks depending on context
    const systemQuery = useTasks(systemId, initialData);
    const folderQuery = useFolderTasks(systemId, folderId ?? "", folderInitialData);
    const { data: tasks = [] } = folderId ? folderQuery : systemQuery;

    const { mutate: toggleTask } = useToggleTask(systemId, folderId);
    const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId, folderId);

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
                    Tareas sin programar. Asígnales una fecha para moverlas a planificación.
                </p>
            </div>
            {backlogTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 border border-dashed rounded-lg bg-card">
                    <p className="text-base font-medium">¡Todo al día!</p>
                    <p className="text-sm text-muted-foreground">
                        Tu backlog está completamente vacío. Todo está programado o completado.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3 w-full">
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
              title="Mover a la papelera"
              description={`"${deleteTarget?.title}" se moverá a la papelera.`}
              confirmLabel="Mover a la papelera"
              onConfirm={() => {
                if (deleteTarget) deleteTask(deleteTarget.id);
                setDeleteTarget(null);
              }}
              onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
