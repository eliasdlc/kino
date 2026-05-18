import { useState } from "react";
import type { Task } from "./tasks.types";
import { useDeleteTask, useTasks, useFolderTasks, useToggleTask } from "./tasks.hooks";
import { TaskCard } from "./TaskCard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTaskKeyboardNavigation } from "./useTaskKeyboardNavigation";

interface TaskArchiveViewProps {
    systemId: string;
    initialData: Task[];
    folderId?: string;
    folderInitialData?: Task[];
    onEdit?: (task: Task) => void;
    keyboardDisabled?: boolean;
}
export function TaskArchiveView({ systemId, initialData, folderId, folderInitialData, onEdit, keyboardDisabled }: TaskArchiveViewProps) {
    // Use folder-scoped or system-scoped tasks depending on context
    const systemQuery = useTasks(systemId, initialData);
    const folderQuery = useFolderTasks(systemId, folderId ?? "", folderInitialData);
    const { data: tasks = [] } = folderId ? folderQuery : systemQuery;

    const { mutate: toggleTask } = useToggleTask(systemId, folderId);
    const { mutate: deleteTask } = useDeleteTask(systemId, folderId);
    
    const archivedTasks = tasks.filter((task) => task.status === "done" || task.status === "archived");

    const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

    const { focusedTaskId } = useTaskKeyboardNavigation(archivedTasks, {
        onSelect: onEdit,
        onToggle: toggleTask,
        onDelete: setDeleteTarget,
    }, {
        enabled: !keyboardDisabled && deleteTarget === null
    });

    return (
        <div className="flex flex-col gap-4 w-full h-full">
            <h2 className="text-2xl font-bold">Archived Tasks</h2>
            <div className="flex flex-col gap-2.5 w-full h-full overflow-y-auto">
                {archivedTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                        No archived tasks.
                    </p>
                ) : (
                    archivedTasks.map((task) => (
                        <TaskCard 
                            key={task.id} 
                            task={task} 
                            systemId={systemId} 
                            isFocused={task.id === focusedTaskId}
                            onToggle={(id) => toggleTask(id)} 
                            onDelete={() => setDeleteTarget(task)} 
                            onEdit={onEdit} 
                        />
                    ))
                )}
            </div>

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