import type { TaskTransport } from "./tasks.types";
import { useTasks, useFolderTasks, useToggleTask, useDeleteTaskWithUndo } from "./tasks.hooks";
import { DefaultTaskCard } from "./cards/DefaultTaskCard";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHead } from "@/features/dashboard/SectionHead";
import { useTaskKeyboardNavigation } from "./useTaskKeyboardNavigation";
import { useSystemManifest } from "@/features/systems/systems.hooks";
import { tasksEmptyCopy } from "@/shared/lib/archetype-copy";
import { useTacharEnSitio } from "./useTachar";

interface TaskBacklogViewProps {
    systemId: string;
    initialData: TaskTransport[];
    folderId?: string;
    folderInitialData?: TaskTransport[];
    onEdit?: (task: TaskTransport) => void;
    keyboardDisabled?: boolean;
}

/**
 * El Backlog: las tareas sin programar (status `backlog`), ideas y vaciados
 * de cabeza que aún no tienen día. Completar tacha la fila en su sitio con
 * Deshacer de cuatro segundos, como en Hoy y en Tareas: la lista filtra por
 * estado, pero una hecha en esta visita se queda tachada hasta la siguiente.
 * Mover a la papelera no pregunta: el aviso trae Deshacer.
 */
export function TaskBacklogView({ systemId, initialData, folderId, folderInitialData, onEdit, keyboardDisabled }: TaskBacklogViewProps) {
    // Use folder-scoped or system-scoped tasks depending on context
    const systemQuery = useTasks(systemId, initialData);
    const folderQuery = useFolderTasks(systemId, folderId ?? "", folderInitialData);
    const { data: tasks = [] } = folderId ? folderQuery : systemQuery;

    const { mutate: toggleTask } = useToggleTask(systemId, folderId);
    const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId, folderId);
    const manifest = useSystemManifest(systemId);
    const empty = tasksEmptyCopy(manifest, "backlog");
    const { struck, handleToggle, estadoDe } = useTacharEnSitio((id) => toggleTask(id));

    const backlogTasks = tasks.filter((t) => estadoDe(t) === "backlog");
    const abiertas = backlogTasks.filter((t) => t.status !== "done");
    const completar = (id: string) => {
        const task = backlogTasks.find((t) => t.id === id);
        if (task) handleToggle(task);
    };

    const { focusedTaskId } = useTaskKeyboardNavigation(backlogTasks, {
        onSelect: onEdit,
        onToggle: completar,
        onDelete: (task) => deleteTask(task.id),
    }, {
        enabled: !keyboardDisabled
    });

    return (
        <div className="flex flex-col gap-4 w-full h-full">
            <div className="space-y-1">
                <SectionHead title="Backlog" count={abiertas.length > 0 ? `${abiertas.length}` : undefined} />
                <p className="pt-1 pl-(--margen) text-sm text-muted-foreground">
                    Tareas sin programar. Asígnales una fecha para moverlas a planificación.
                </p>
            </div>
            {backlogTasks.length === 0 ? (
                <EmptyState className="pl-(--margen)" title={empty.title} description={empty.hint} />
            ) : (
                <div className="w-full">
                    {backlogTasks.map((task) => (
                        <DefaultTaskCard
                            key={task.id}
                            task={task}
                            systemId={systemId}
                            isFocused={task.id === focusedTaskId}
                            struck={struck.has(task.id)}
                            onToggle={completar}
                            onDelete={() => deleteTask(task.id)}
                            onEdit={onEdit}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
