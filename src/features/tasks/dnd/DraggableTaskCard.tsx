"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { TaskCard } from "../TaskCard";
import type { Task } from "../tasks.types";
import type { TaskDragData, DragSourceType } from "./dnd.types";

interface DraggableTaskCardProps {
  task: Task;
  systemId: string;
  sourceType: DragSourceType;
  sourceId: string;
  isFocused?: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (task: Task) => void;
  onEdit?: (task: Task) => void;
}

/**
 * Wraps TaskCard with drag capabilities.
 * Done/archived tasks are not draggable.
 * When actively dragging, the original card shows a ghosted placeholder.
 */
export function DraggableTaskCard({
  task,
  systemId,
  sourceType,
  sourceId,
  isFocused,
  onToggle,
  onDelete,
  onEdit,
}: DraggableTaskCardProps) {
  const isDoneOrArchived = task.status === "done" || task.status === "archived";

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "touch-none", // Prevents scroll jank on mobile during drag
        isDragging && "opacity-40 border-dashed pointer-events-none"
      )}
    >
      <TaskCard
        task={task}
        systemId={systemId}
        isFocused={isFocused}
        onToggle={onToggle}
        onDelete={onDelete}
        onEdit={onEdit}
      />
    </div>
  );
}
