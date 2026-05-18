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
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 border border-dashed rounded-lg bg-card">
                        <p className="text-sm font-medium">Nothing here yet</p>
                        <p className="text-sm text-muted-foreground">
                            Tasks that are completed will appear here for your reference.
                        </p>
                    </div>
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
              title="Move to trash"
              description={`"${deleteTarget?.title}" will be moved to the trash.`}
              confirmLabel="Move to trash"
              onConfirm={() => {
                if (deleteTarget) deleteTask(deleteTarget.id);
                setDeleteTarget(null);
              }}
              onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}