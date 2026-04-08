"use client";

import type { Task } from "./tasks.types";
import { useTasks, useToggleTask } from "./tasks.hooks";
import { TaskCard } from "./TaskCard";

interface TaskActionViewProps {
    systemId: string;
    initialData: Task[];
}

export function TaskActionView({ systemId, initialData }: TaskActionViewProps) {
    const { data: tasks } = useTasks(systemId, initialData);
    const { mutate: toggleTask } = useToggleTask(systemId);

    if (!tasks || tasks.length === 0) {
        return (
            <p className="text-sm text-muted-foreground py-6 text-center">
                Sin tareas. Crea una con el botón de arriba.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-1.5">
            {tasks.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={(id) => toggleTask(id)} />
            ))}
        </div>
    );
}