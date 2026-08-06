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
import type { TaskDragData } from "./dnd/dnd.types";
import { useTasks, useFolderTasks, useToggleTask, useDeleteTaskWithUndo, useUpdateTask } from "./tasks.hooks";
import { useFolders } from "@/features/folders/folders.hooks";
import { DraggableTaskCard } from "./dnd/DraggableTaskCard";
import { DroppableColumn } from "./dnd/DroppableColumn";
import { TaskDragOverlay } from "./dnd/TaskDragOverlay";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTaskKeyboardNavigation } from "./useTaskKeyboardNavigation";
import { useSystemManifest } from "@/features/systems/systems.hooks";
import { tasksEmptyCopy } from "@/shared/lib/archetype-copy";

interface TaskKanbanViewProps {
    systemId: string;
    initialData: Task[];
    folderId?: string;
    folderInitialData?: Task[];
    onEdit?: (task: Task) => void;
    keyboardDisabled?: boolean;
    defaultGroupBy?: KanbanGroupBy;
}

type KanbanGroupBy = "energy" | "priority" | "project";

interface ColumnDef {
    id: string;
    label: string;
    description: string;
}

/** Columna sentinel para tareas sin folder/proyecto. */
const NO_PROJECT = "sin-proyecto";

const ENERGY_COLUMNS: ColumnDef[] = [
    { id: "high", label: "Energía alta", description: "Tareas que requieren mucho foco." },
    { id: "medium", label: "Energía media", description: "Trabajo constante, foco moderado." },
    { id: "low", label: "Energía baja", description: "Tareas ligeras, fáciles de retomar." },
];

const PRIORITY_COLUMNS: ColumnDef[] = [
    { id: "critical", label: "Crítica", description: "Deja todo lo demás." },
    { id: "high", label: "Alta", description: "Hazlas pronto." },
    { id: "medium", label: "Media", description: "Prioridad normal." },
    { id: "low", label: "Baja", description: "Cuando haya espacio." },
];

/** Campo de la tarea que define en qué columna cae, según el agrupamiento. */
function taskGroupKey(task: Task, groupBy: KanbanGroupBy): string {
    if (groupBy === "energy") return task.energyLevel ?? "medium";
    if (groupBy === "priority") return task.priority ?? "medium";
    return task.folderId ?? NO_PROJECT;
}

export function TaskKanbanView({ systemId, initialData, folderId, folderInitialData, onEdit, keyboardDisabled, defaultGroupBy = "energy" }: TaskKanbanViewProps) {
    // Use folder-scoped or system-scoped tasks depending on context
    const systemQuery = useTasks(systemId, initialData);
    const folderQuery = useFolderTasks(systemId, folderId ?? "", folderInitialData);
    const { data: tasks } = folderId ? folderQuery : systemQuery;

    const { mutate: toggleTask } = useToggleTask(systemId, folderId);
    const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId, folderId);
    const { mutate: updateTask } = useUpdateTask(systemId);
    const { data: folders = [] } = useFolders(systemId);

    const [groupBy, setGroupBy] = useState<KanbanGroupBy>(defaultGroupBy);
    const [activeTask, setActiveTask] = useState<Task | null>(null);

    const projectColumns: ColumnDef[] = [
        ...folders.map((f) => ({ id: f.id, label: f.name, description: "" })),
        { id: NO_PROJECT, label: "Sin proyecto", description: "Tareas sin folder asignado." },
    ];
    const columns =
        groupBy === "energy" ? ENERGY_COLUMNS
        : groupBy === "priority" ? PRIORITY_COLUMNS
        : projectColumns;

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
    // Only show non-done tasks in the columns
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

            const targetId = over.id as string;

            // Same column — no-op
            if (targetId === data.sourceId) return;

            updateTask({
                taskId: data.task.id,
                data: data.sourceType === "priority"
                    ? { priority: targetId as Task["priority"] }
                    : data.sourceType === "project"
                    ? { folderId: targetId === NO_PROJECT ? null : targetId }
                    : { energyLevel: targetId as Task["energyLevel"] },
            });
        },
        [updateTask]
    );

    const handleDragCancel = useCallback(() => {
        setActiveTask(null);
    }, []);

    const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
    const manifest = useSystemManifest(systemId);
    const empty = tasksEmptyCopy(manifest, "action");

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
                <p className="text-base font-medium">{empty.title}</p>
                <p className="text-sm text-muted-foreground max-w-sm">{empty.hint}</p>
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
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h2 className="text-2xl font-bold">Progreso de la semana</h2>
                    <select
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value as KanbanGroupBy)}
                        className="text-sm bg-muted border-0 rounded-md px-2 py-1 text-muted-foreground"
                    >
                        <option value="energy">Por energía</option>
                        <option value="priority">Por prioridad</option>
                        <option value="project">Por proyecto</option>
                    </select>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${groupBy === "priority" || groupBy === "project" ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3 w-full`}>
                    {columns.map((column) => {
                        const columnTasks = activeTasks.filter(
                            (task) => taskGroupKey(task, groupBy) === column.id
                        );

                        return (
                            <DroppableColumn
                                key={column.id}
                                id={column.id}
                                className="flex flex-col gap-2 min-w-0"
                            >
                                <h3 className="font-semibold text-base">{column.label}</h3>
                                {column.description && (
                                    <p className="text-sm text-muted-foreground">{column.description}</p>
                                )}
                                <div className="flex flex-col gap-2">
                                    {columnTasks.map((task) => (
                                        <DraggableTaskCard
                                            key={task.id}
                                            task={task}
                                            systemId={systemId}
                                            sourceType={groupBy}
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
              title="Mover a la papelera"
              description={`"${deleteTarget?.title}" se moverá a la papelera.`}
              confirmLabel="Mover a la papelera"
              onConfirm={() => {
                if (deleteTarget) deleteTask(deleteTarget.id);
                setDeleteTarget(null);
              }}
              onCancel={() => setDeleteTarget(null)}
            />
        </DndContext>
    );
}
