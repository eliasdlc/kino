import type { Task } from "./tasks.types";
import { useDeleteTask, useTasks, useToggleTask } from "./tasks.hooks";
import { TaskCard } from "./TaskCard";

interface TaskArchiveViewProps {
    systemId: string;
    initialData: Task[];
}
export function TaskArchiveView({ systemId, initialData }: TaskArchiveViewProps) {
    const { data: tasks = [] } = useTasks(systemId, initialData);
    const { mutate: toggleTask } = useToggleTask(systemId);
    const { mutate: deleteTask } = useDeleteTask(systemId);
    
    const archivedTasks = tasks.filter((task) => task.status === "done" || task.status === "archived");

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
                        <TaskCard key={task.id} task={task} systemId={systemId} onToggle={(id) => toggleTask(id)} onDelete={(id) => deleteTask(id)} />
                    ))
                )}
            </div>
        </div>
    );
}