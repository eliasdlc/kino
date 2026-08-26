import { useState } from "react";
import type { TaskTransport } from "./tasks.types";
import { useDeleteTaskWithUndo, useTasks, useFolderTasks, useToggleTask } from "./tasks.hooks";
import { DefaultTaskCard } from "./cards/DefaultTaskCard";
import { TaskTrashSection } from "./TaskTrashSection";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTaskKeyboardNavigation } from "./useTaskKeyboardNavigation";
import { useSystemManifest } from "@/features/systems/systems.hooks";
import { tasksEmptyCopy } from "@/shared/lib/archetype-copy";

interface TaskArchiveViewProps {
    systemId: string;
    initialData: TaskTransport[];
    folderId?: string;
    folderInitialData?: TaskTransport[];
    onEdit?: (task: TaskTransport) => void;
    keyboardDisabled?: boolean;
}
export function TaskArchiveView({ systemId, initialData, folderId, folderInitialData, onEdit, keyboardDisabled }: TaskArchiveViewProps) {
    // Use folder-scoped or system-scoped tasks depending on context
    const systemQuery = useTasks(systemId, initialData);
    const folderQuery = useFolderTasks(systemId, folderId ?? "", folderInitialData);
    const { data: tasks = [] } = folderId ? folderQuery : systemQuery;

    const { mutate: toggleTask } = useToggleTask(systemId, folderId);
    const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId, folderId);
    const manifest = useSystemManifest(systemId);
    const empty = tasksEmptyCopy(manifest, "archive");
    
    const archivedTasks = tasks.filter((task) => task.status === "done" || task.status === "archived");

    const [deleteTarget, setDeleteTarget] = useState<TaskTransport | null>(null);

    const { focusedTaskId } = useTaskKeyboardNavigation(archivedTasks, {
        onSelect: onEdit,
        onToggle: toggleTask,
        onDelete: setDeleteTarget,
    }, {
        enabled: !keyboardDisabled && deleteTarget === null
    });

    return (
        <div className="flex flex-col gap-4 w-full h-full">
            <h2 className="text-2xl font-bold">Tareas archivadas</h2>
            <div className="flex flex-col gap-2.5 w-full h-full overflow-y-auto">
                {archivedTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-2 border border-dashed rounded-lg bg-card">
                        <p className="text-sm font-medium">{empty.title}</p>
                        <p className="text-sm text-muted-foreground">{empty.hint}</p>
                    </div>
                ) : (
                    archivedTasks.map((task) => (
                        <DefaultTaskCard
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

            {/* Papelera: tareas borradas (deletedAt) — restaurables */}
            <TaskTrashSection systemId={systemId} />

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