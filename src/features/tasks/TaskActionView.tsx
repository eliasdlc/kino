"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Task } from "./tasks.types";
import type { TaskDragData, EnergyDropId } from "./dnd/dnd.types";
import { useTasks, useFolderTasks, useToggleTask, useDeleteTaskWithUndo, useUpdateTask } from "./tasks.hooks";
import { DraggableTaskCard } from "./dnd/DraggableTaskCard";
import { DroppableColumn } from "./dnd/DroppableColumn";
import { TaskDragOverlay } from "./dnd/TaskDragOverlay";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTaskKeyboardNavigation } from "./useTaskKeyboardNavigation";

interface TaskActionViewProps {
    systemId: string;
    initialData: Task[];
    folderId?: string;
    folderInitialData?: Task[];
    onEdit?: (task: Task) => void;
    keyboardDisabled?: boolean;
}

const ENERGY_COLUMNS: { id: EnergyDropId; label: string; description: string }[] = [
    { id: "high", label: "High Energy", description: "Tasks requiring high focus." },
    { id: "medium", label: "Medium Energy", description: "Steady work, moderate focus." },
    { id: "low", label: "Low Energy", description: "Light tasks, easy to pick up." },
];

export function TaskActionView({ systemId, initialData, folderId, folderInitialData, onEdit, keyboardDisabled }: TaskActionViewProps) {
    // Use folder-scoped or system-scoped tasks depending on context
    const systemQuery = useTasks(systemId, initialData);
    const folderQuery = useFolderTasks(systemId, folderId ?? "", folderInitialData);
    const { data: tasks } = folderId ? folderQuery : systemQuery;

    const { mutate: toggleTask } = useToggleTask(systemId, folderId);
    const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId, folderId);
    const { mutate: updateTask } = useUpdateTask(systemId);

    const [activeTask, setActiveTask] = useState<Task | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, keyboardDisabled ? { keyboardCodes: { start: [], cancel: [], end: [] } } : {})
    );

    // Include "done" alongside active statuses to compute progress correctly
    const actionableTasks = tasks?.filter(
      (t) => t.status === "today" || t.status === "tomorrow" || t.status === "week" || t.status === "done"
    ) ?? [];
    // Only show non-done tasks in the energy columns
    const activeTasks = actionableTasks.filter((t) => t.status !== "done");

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const data = event.active.data.current as TaskDragData | undefined;
        if (data?.task) {
            setActiveTask(data.task);
        }
    }, []);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            setActiveTask(null);

            const { active, over } = event;
            if (!over) return;

            const data = active.data.current as TaskDragData | undefined;
            if (!data) return;

            const targetEnergy = over.id as EnergyDropId;

            // Same column — no-op
            if (targetEnergy === data.sourceId) return;

            updateTask({
                taskId: data.task.id,
                data: { energyLevel: targetEnergy },
            });
        },
        [updateTask]
    );

    const handleDragCancel = useCallback(() => {
        setActiveTask(null);
    }, []);

    const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

    const { focusedTaskId } = useTaskKeyboardNavigation(activeTasks, {
        onSelect: onEdit,
        onToggle: toggleTask,
        onDelete: setDeleteTarget,
    }, {
        enabled: !keyboardDisabled && deleteTarget === null
    });

    if (!tasks || activeTasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 border border-dashed rounded-lg bg-card mt-6">
                <p className="text-base font-medium">No tasks for today</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                    You don&apos;t have any tasks scheduled. Go to the <strong>Planning</strong> tab to line up work for today or the upcoming week.
                </p>
            </div>
        );
    }

    const doneCount = actionableTasks.filter((t) => t.status === "done").length;
    const progressPercent = actionableTasks.length > 0 ? (doneCount / actionableTasks.length) * 100 : 0;

    return (
        <DndContext
            id="task-action-dnd"
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <div className="flex flex-col gap-4 w-full h-full">
                <h2 className="text-2xl font-bold">Daily Progress</h2>
                <Progress value={progressPercent} className="h-2" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                    {ENERGY_COLUMNS.map((column) => {
                        const columnTasks = activeTasks.filter(
                            (task) => task.energyLevel === column.id
                        );

                        return (
                            <DroppableColumn
                                key={column.id}
                                id={column.id}
                                className="flex flex-col gap-2 min-w-0"
                            >
                                <h3 className="font-semibold text-base">{column.label}</h3>
                                <p className="text-sm text-muted-foreground">{column.description}</p>
                                <div className="flex flex-col gap-2">
                                    {columnTasks.map((task) => (
                                        <DraggableTaskCard
                                            key={task.id}
                                            task={task}
                                            systemId={systemId}
                                            sourceType="energy"
                                            sourceId={column.id}
                                            isFocused={task.id === focusedTaskId}
                                            onToggle={(id) => toggleTask(id)}
                                            onDelete={() => setDeleteTarget(task)}
                                            onEdit={onEdit}
                                        />
                                    ))}
                                </div>
                            </DroppableColumn>
                        );
                    })}
                </div>
            </div>

            {/* Floating drag preview */}
            <TaskDragOverlay activeTask={activeTask} systemId={systemId} />

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
        </DndContext>
    );
}