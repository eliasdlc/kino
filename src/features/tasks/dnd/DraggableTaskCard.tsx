"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { TaskCardFor } from "../cards/TaskCardFor";
import { PlanningTaskCard } from "../PlanningTaskCard";
import type { TaskTransport } from "../tasks.types";
import type { SystemType } from "@/shared/lib/system-types";
import type { TaskDragData, DragSourceType } from "./dnd.types";

interface DraggableTaskCardProps {
  task: TaskTransport;
  systemId: string;
  sourceType: DragSourceType;
  sourceId: string;
  /** Elige el layout de card por tipo de sistema (default: fila genérica). */
  systemType?: SystemType;
  isFocused?: boolean;
  /** Renderiza la variante compacta (columnas estrechas de Planificación). */
  compact?: boolean;
  /** Tachada en esta visita: se queda en su columna con el círculo lleno. */
  struck?: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (task: TaskTransport) => void;
  onEdit?: (task: TaskTransport) => void;
}

/**
 * La fila de tarea con arrastre, para los tableros de escritorio. Una hecha no
 * se arrastra; mientras se arrastra, la original queda a media opacidad.
 */
export function DraggableTaskCard({
  task,
  systemId,
  sourceType,
  sourceId,
  systemType,
  isFocused,
  compact,
  struck,
  onToggle,
  onDelete,
  onEdit,
}: DraggableTaskCardProps) {
  const isDoneOrArchived = task.status === "done";

  const dragData: TaskDragData = {
    task,
    sourceType,
    sourceId,
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: dragData,
    disabled: isDoneOrArchived,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  // Only activate keyboard drag when the card itself is focused, not a child element
  // (buttons, subtask inputs, delete dialogs, etc. all bubble keydown through the React tree)
  const handleKeyDown: React.KeyboardEventHandler = (e) => {
    if (e.target !== e.currentTarget) return;
    listeners?.onKeyDown?.(e as unknown as KeyboardEvent);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onKeyDown={handleKeyDown}
      // Sin `touch-none`: el arrastre es sólo de ratón y teclado (MouseSensor),
      // así que el dedo desplaza la página como en cualquier otra lista.
      className={cn(isDragging && "pointer-events-none opacity-40")}
    >
      {compact ? (
        <PlanningTaskCard
          task={task}
          isFocused={isFocused}
          struck={struck}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ) : (
        <TaskCardFor
          systemType={systemType}
          task={task}
          systemId={systemId}
          isFocused={isFocused}
          struck={struck}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      )}
    </div>
  );
}
