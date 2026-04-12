"use client";

import type { Task } from "./tasks.types";
import { useTasks, useToggleTask, useDeleteTask } from "./tasks.hooks";
import { TaskCard } from "./TaskCard";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface TaskActionViewProps {
    systemId: string;
    initialData: Task[];
}

export function TaskActionView({ systemId, initialData }: TaskActionViewProps) {
    const { data: tasks } = useTasks(systemId, initialData);
    const { mutate: toggleTask } = useToggleTask(systemId);
    const { mutate: deleteTask } = useDeleteTask(systemId);

    if (!tasks || tasks.length === 0) {
        return (
            <p className="text-sm text-muted-foreground py-6 text-center">
                No tasks. Create one with the button above.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-4 w-full h-full">
            <h2 className="text-2xl font-bold">Daily Progress</h2>
            <Progress value={tasks.filter((task) => task.status === "done").length / tasks.length * 100} className="h-2" />
            <div className="flex flex-rows gap-2.5 w-full h-full">
                <div className="flex flex-col gap-1.5 w-full h-full">
                    <h3>High Energy</h3>
                    <p className="text-sm text-muted-foreground">Tasks that require a lot of energy to complete.</p>
                    <div className="flex flex-col gap-1.5">
                        {tasks.filter((task) => task.energyLevel === "high" && task.status !== "done" && task.status !== "archived").map((task) => (
                            <TaskCard key={task.id} task={task} systemId={systemId} onToggle={(id) => toggleTask(id)} onDelete={(id) => deleteTask(id)} />
                        ))}
                    </div>
                </div>
                <Separator orientation="vertical" />
                <div className="flex flex-col gap-1.5 w-full h-full">
                    <h3>Medium Energy</h3>
                    <p className="text-sm text-muted-foreground">Tasks that require a medium amount of energy to complete.</p>
                    <div className="flex flex-col gap-1.5">
                        {tasks.filter((task) => task.energyLevel === "medium" && task.status !== "done" && task.status !== "archived").map((task) => (
                            <TaskCard key={task.id} task={task} systemId={systemId} onToggle={(id) => toggleTask(id)} onDelete={(id) => deleteTask(id)} />
                        ))}
                    </div>
                </div>
                <Separator orientation="vertical" className="self-stretch h-auto" />
           
                <div className="flex flex-col gap-1.5 w-full h-full">
                    <h3>Low Energy</h3>
                    <p className="text-sm text-muted-foreground">Tasks that require a low amount of energy to complete.</p>
                    <div className="flex flex-col gap-1.5">
                        {tasks.filter((task) => task.energyLevel === "low" && task.status !== "done" && task.status !== "archived").map((task) => (
                            <TaskCard key={task.id} task={task} systemId={systemId} onToggle={(id) => toggleTask(id)} onDelete={(id) => deleteTask(id)} />
                        ))}
                    </div>
                </div>
                <Separator orientation="vertical" className="self-stretch h-auto" />
            </div>
        </div>
    );
}