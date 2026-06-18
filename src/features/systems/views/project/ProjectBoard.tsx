"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { PROJECT_BOARD_COLUMNS } from "@/shared/lib/system-types";
import { useTasks, useToggleTask, useDeleteTaskWithUndo, useMoveTaskBoard } from "@/features/tasks/tasks.hooks";
import { DroppableColumn } from "@/features/tasks/dnd/DroppableColumn";
import { TaskDragOverlay } from "@/features/tasks/dnd/TaskDragOverlay";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BoardCard } from "./BoardCard";
import { computeBoardMetrics } from "./board.metrics";
import type { Task } from "@/features/tasks/tasks.types";
import type { TaskDragData } from "@/features/tasks/dnd/dnd.types";

interface ProjectBoardProps {
  systemId: string;
  initialData: Task[];
  /** null = todas; "none" = sin sprint; uuid = ese sprint. */
  sprintFilter: string | null;
  onEdit?: (task: Task) => void;
  keyboardDisabled?: boolean;
}

const FIRST_COLUMN = PROJECT_BOARD_COLUMNS[0].id;

/** Columna del board en la que cae una tarjeta (board_status null → primera). */
function boardColumnOf(task: Task): string {
  return task.boardStatus ?? FIRST_COLUMN;
}

export function ProjectBoard({ systemId, initialData, sprintFilter, onEdit, keyboardDisabled }: ProjectBoardProps) {
  const { data: tasks = [] } = useTasks(systemId, initialData);
  const { mutate: toggleTask } = useToggleTask(systemId);
  const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId);
  const { mutate: moveBoard } = useMoveTaskBoard(systemId);

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Touch: pequeño delay para no pelear con el scroll de la página (F5).
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, keyboardDisabled ? { keyboardCodes: { start: [], cancel: [], end: [] } } : {}),
  );

  const visible = tasks.filter((t) => {
    if (t.deletedAt || t.status === "archived") return false;
    if (sprintFilter === null) return true;
    if (sprintFilter === "none") return t.sprintId === null;
    return t.sprintId === sprintFilter;
  });

  const metrics = computeBoardMetrics(visible);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const data = e.active.data.current as TaskDragData | undefined;
    if (data?.task) setActiveTask(data.task);
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = e;
      if (!over) return;
      const data = active.data.current as TaskDragData | undefined;
      if (!data) return;
      const targetCol = over.id as string;
      if (targetCol === data.sourceId) return;
      moveBoard({ taskId: data.task.id, boardStatus: targetCol });
    },
    [moveBoard],
  );

  return (
    <DndContext
      id="project-board-dnd"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{metrics.active} activas</span>
        <span>·</span>
        <span>{metrics.done} hechas</span>
        {metrics.stalled > 0 && (
          <>
            <span>·</span>
            <span className="text-amber-600 dark:text-amber-400">
              {metrics.stalled} estancada{metrics.stalled > 1 ? "s" : ""}
            </span>
          </>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full items-start mt-3">
        {PROJECT_BOARD_COLUMNS.map((col) => {
          const colTasks = visible.filter((t) => boardColumnOf(t) === col.id);
          return (
            <DroppableColumn
              key={col.id}
              id={col.id}
              className="flex flex-col gap-2 min-w-0 rounded-xl border bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{col.label}</h3>
                <span className="text-xs text-muted-foreground font-mono">{colTasks.length}</span>
              </div>
              <div className="flex flex-col gap-2 min-h-[40px]">
                {colTasks.map((task) => (
                  <BoardCard
                    key={task.id}
                    task={task}
                    systemId={systemId}
                    onToggle={(id) => toggleTask(id)}
                    onDelete={() => setDeleteTarget(task)}
                    onEdit={onEdit}
                    onMoveColumn={(boardStatus) => moveBoard({ taskId: task.id, boardStatus })}
                    showSprint={sprintFilter === null}
                  />
                ))}
              </div>
            </DroppableColumn>
          );
        })}
      </div>

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
