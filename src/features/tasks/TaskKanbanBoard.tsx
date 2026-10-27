"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  MouseSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { TaskTransport } from "./tasks.types";
import type { TaskDragData } from "./dnd/dnd.types";
import { DraggableTaskCard } from "./dnd/DraggableTaskCard";
import { DroppableColumn } from "./dnd/DroppableColumn";
import { TaskDragOverlay } from "./dnd/TaskDragOverlay";
import type { KanbanColumn, KanbanGroupBy } from "./kanban";

export interface TaskKanbanBoardProps {
  systemId: string;
  groupBy: KanbanGroupBy;
  columns: KanbanColumn[];
  tasksOf: (columnId: string) => TaskTransport[];
  focusedTaskId: string | null;
  /** Las tachadas en esta visita: siguen en su columna, con el círculo lleno. */
  struck?: ReadonlySet<string>;
  keyboardDisabled?: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (task: TaskTransport) => void;
  onEdit?: (task: TaskTransport) => void;
  onMove: (task: TaskTransport, columnId: string) => void;
}

/**
 * Las columnas de Acción en escritorio, con arrastre de ratón y de teclado.
 * Es el único módulo de la vista que importa `@dnd-kit`, y `TaskKanbanView`
 * lo carga aparte y sólo en escritorio: el teléfono mueve con una hoja.
 */
export default function TaskKanbanBoard({
  systemId,
  groupBy,
  columns,
  tasksOf,
  focusedTaskId,
  struck,
  keyboardDisabled,
  onToggle,
  onDelete,
  onEdit,
  onMove,
}: TaskKanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<TaskTransport | null>(null);

  const sensors = useSensors(
    // Sólo ratón y teclado: con el dedo no se arrastra.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, keyboardDisabled ? { keyboardCodes: { start: [], cancel: [], end: [] } } : {}),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as TaskDragData | undefined;
    if (data?.task) setActiveTask(data.task);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;
      const data = active.data.current as TaskDragData | undefined;
      if (!data) return;
      const targetId = over.id as string;
      if (targetId === data.sourceId) return;
      onMove(data.task, targetId);
    },
    [onMove],
  );

  return (
    <DndContext
      id="task-action-dnd"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className={cn("grid w-full grid-cols-2 gap-4", columns.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {columns.map((column) => {
          const columnTasks = tasksOf(column.id);
          return (
            <DroppableColumn key={column.id} id={column.id} className="flex min-w-0 flex-col p-1.5">
              <div className="flex items-baseline justify-between gap-2 border-b border-input pb-1.5">
                <h3 className="font-display text-base leading-tight font-bold tracking-[-0.01em]">{column.label}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{columnTasks.length}</span>
              </div>
              {column.description && <p className="pt-1.5 text-xs text-muted-foreground">{column.description}</p>}
              <div>
                {columnTasks.map((task) => (
                  <DraggableTaskCard
                    key={task.id}
                    task={task}
                    systemId={systemId}
                    sourceType={groupBy}
                    sourceId={column.id}
                    compact
                    isFocused={task.id === focusedTaskId}
                    struck={struck?.has(task.id)}
                    onToggle={onToggle}
                    onDelete={() => onDelete(task)}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </DroppableColumn>
          );
        })}
      </div>

      <TaskDragOverlay activeTask={activeTask} systemId={systemId} />
    </DndContext>
  );
}
