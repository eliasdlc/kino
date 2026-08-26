"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProjectTaskCard } from "@/features/tasks/cards/ProjectTaskCard";
import { PROJECT_BOARD_COLUMNS } from "@/shared/lib/system-types";
import { boardAgingDays, isStalled } from "./board.metrics";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import type { TaskDragData } from "@/features/tasks/dnd/dnd.types";

interface BoardCardProps {
  task: TaskTransport;
  systemId: string;
  isFocused?: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (task: TaskTransport) => void;
  onEdit?: (task: TaskTransport) => void;
  /** Fallback móvil: mover de columna con un select en vez de arrastrar. */
  onMoveColumn?: (boardStatus: string) => void;
  /** Muestra el sprint de la tarjeta (vista 'Todas'). */
  showSprint?: boolean;
}

/**
 * Tarjeta arrastrable del board kanban. A diferencia de `DraggableTaskCard`
 * (Action/Planning), las tarjetas en la columna terminal (done) SÍ son
 * arrastrables, para poder reabrirlas sacándolas de "Hecho".
 */
export function BoardCard({ task, systemId, isFocused, onToggle, onDelete, onEdit, onMoveColumn, showSprint }: BoardCardProps) {
  const isMobile = useIsMobile();

  const dragData: TaskDragData = {
    task,
    sourceType: "board",
    sourceId: task.boardStatus ?? PROJECT_BOARD_COLUMNS[0].id,
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: dragData,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  const stalled = isStalled(task);
  const aging = boardAgingDays(task);

  const handleKeyDown: React.KeyboardEventHandler = (e) => {
    if (e.target !== e.currentTarget) return;
    listeners?.onKeyDown?.(e as unknown as KeyboardEvent);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isMobile ? {} : listeners)}
      onKeyDown={handleKeyDown}
      className={cn(!isMobile && "touch-none", isDragging && "opacity-0 pointer-events-none")}
    >
      {stalled && aging !== null && (
        <div className="flex justify-end mb-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-medium px-1.5 py-0.5">
            {aging}d sin avanzar
          </span>
        </div>
      )}
      <ProjectTaskCard
        task={task}
        systemId={systemId}
        isFocused={isFocused}
        onToggle={onToggle}
        onDelete={onDelete}
        onEdit={onEdit}
        showSprint={showSprint}
        onMoveColumn={onMoveColumn}
      />
    </div>
  );
}
