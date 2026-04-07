"use client";

import type { Task } from "./tasks.types";
import { useTasks, useToggleTask } from "./tasks.hooks";
import { TaskCard } from "./TaskCard";
import { CreateTaskDialog } from "./CreateTaskDialog";

interface TasksListProps {
  systemId: string;
  initialData: Task[];
}

export function TasksList({ systemId, initialData }: TasksListProps) {
  const { data: tasks } = useTasks(systemId, initialData);
  const { mutate: toggleTask } = useToggleTask(systemId);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Tareas</h2>
        <CreateTaskDialog systemId={systemId} />
      </div>

      {tasks && tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Sin tareas. Crea una con el botón de arriba.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {tasks?.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={(taskId) => toggleTask(taskId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
