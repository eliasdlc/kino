"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DroppableColumnProps {
  /** Unique droppable ID — ISO date, "unscheduled", or energy level */
  id: string;
  children: ReactNode;
  className?: string;
}

/**
 * Generic droppable container.
 * Applies visual feedback (dashed border + tinted background) when a task
 * is hovering over it.
 */
export function DroppableColumn({ id, children, className }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-colors duration-200 rounded-lg",
        isOver && "bg-primary/5 ring-2 ring-dashed ring-primary/30",
        className
      )}
    >
      {children}
    </div>
  );
}
