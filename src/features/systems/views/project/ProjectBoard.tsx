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
import { BoardMoveSheet } from "./BoardMoveSheet";
import { computeBoardMetrics } from "./board.metrics";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { TaskDragData } from "@/features/tasks/dnd/dnd.types";

interface ProjectBoardProps {
  systemId: string;
  initialData: TaskTransport[];
  /** null = todas; "none" = sin sprint; uuid = ese sprint. */
  sprintFilter: string | null;
  onEdit?: (task: TaskTransport) => void;
  keyboardDisabled?: boolean;
}

const FIRST_COLUMN = PROJECT_BOARD_COLUMNS[0].id;

/** Columna del board en la que cae una tarjeta (board_status null → primera). */
export function boardColumnOf(task: TaskTransport): string {
  return task.boardStatus ?? FIRST_COLUMN;
}

/**
 * El destino efectivo de un movimiento, o `null` cuando no hay nada que
 * escribir porque la tarjeta ya está ahí.
 *
 * Es la guarda que el arrastre tenía y el camino con nombre no, y vive suelta
 * porque los dos caminos la comparten: esa es la equivalencia entre la
 * superficie de escritorio y la del teléfono, y es lo único que hay que probar
 * una vez para las dos.
 */
export function boardMoveTarget(task: TaskTransport, targetCol: string): string | null {
  return targetCol === boardColumnOf(task) ? null : targetCol;
}

export function ProjectBoard({ systemId, initialData, sprintFilter, onEdit, keyboardDisabled }: ProjectBoardProps) {
  const { data: tasks = [] } = useTasks(systemId, initialData);
  const { mutate: toggleTask } = useToggleTask(systemId);
  const { mutate: deleteTask } = useDeleteTaskWithUndo(systemId);
  const { mutate: moveBoard } = useMoveTaskBoard(systemId);

  const [activeTask, setActiveTask] = useState<TaskTransport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskTransport | null>(null);
  /** La tarjeta que la hoja de mover esta enseñando, o nada si esta cerrada. */
  const [movingTask, setMovingTask] = useState<TaskTransport | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Touch: pequeño delay para no pelear con el scroll de la página (F5).
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, keyboardDisabled ? { keyboardCodes: { start: [], cancel: [], end: [] } } : {}),
  );

  const visible = tasks.filter((t) => {
    if (t.deletedAt) return false;
    if (sprintFilter === null) return true;
    if (sprintFilter === "none") return t.sprintId === null;
    return t.sprintId === sprintFilter;
  });

  const metrics = computeBoardMetrics(visible);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const data = e.active.data.current as TaskDragData | undefined;
    if (data?.task) setActiveTask(data.task);
  }, []);

  /**
   * La unica puerta a la mutacion de columna, para el arrastre y para la hoja.
   * Mover a la columna donde la tarjeta ya esta no escribe ni deja evento: la
   * guarda vive aqui y no en quien dibuja los destinos.
   */
  const moveToColumn = useCallback(
    (task: TaskTransport, targetCol: string) => {
      const destino = boardMoveTarget(task, targetCol);
      if (destino === null) return;
      moveBoard({ taskId: task.id, boardStatus: destino });
    },
    [moveBoard],
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = e;
      if (!over) return;
      const data = active.data.current as TaskDragData | undefined;
      if (!data) return;
      moveToColumn(data.task, over.id as string);
    },
    [moveToColumn],
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
                    onRequestMove={() => setMovingTask(task)}
                    showSprint={sprintFilter === null}
                  />
                ))}
              </div>
            </DroppableColumn>
          );
        })}
      </div>

      <TaskDragOverlay activeTask={activeTask} systemId={systemId} />

      <BoardMoveSheet
        open={movingTask !== null}
        onOpenChange={(next) => !next && setMovingTask(null)}
        subject={movingTask?.title ?? ""}
        destinations={PROJECT_BOARD_COLUMNS}
        currentId={movingTask ? boardColumnOf(movingTask) : FIRST_COLUMN}
        onMove={(boardStatus) => {
          if (movingTask) moveToColumn(movingTask, boardStatus);
          setMovingTask(null);
        }}
      />

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
