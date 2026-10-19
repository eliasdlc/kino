"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DroppableColumnProps {
  /** Unique droppable ID: ISO date, "unscheduled", or energy level */
  id: string;
  children: ReactNode;
  className?: string;
}

/**
 * Generic droppable container.
 * Mientras una tarea pasa por encima, el fondo sube a sf2 con el hairline
 * fuerte: un estado, en tinta, no el ámbar de la acción.
 */
export function DroppableColumn({ id, children, className }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md transition-[background-color,box-shadow] duration-(--dur-toque) ease-(--ease-pluma)",
        isOver && "bg-sf2 ring-1 ring-input",
        className
      )}
    >
      {children}
    </div>
  );
}
