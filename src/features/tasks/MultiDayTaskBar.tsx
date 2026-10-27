import React from "react";
import type { TaskTransport } from "./tasks.types";
import { cn } from "@/lib/utils";
import { shortDate } from "./task-vocab";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * La barra de una tarea de varios días: neutra sobre sf2, sin sombra. La
 * prioridad es peso de la letra, como en la fila: el coral es de vencida y el
 * ámbar de la acción, así que ninguna prioridad los usa.
 */
const multiDayBarVariants = cva(
  "flex min-h-[2.85rem] cursor-pointer items-center gap-2 rounded-md bg-secondary px-2.5 text-xs text-foreground transition-[background-color] duration-(--dur-toque) ease-(--ease-pluma) hover:bg-sf2 md:pointer-fine:min-h-7",
  {
    variants: {
      priority: {
        critical: "font-bold",
        high: "font-semibold",
        medium: "font-medium",
        low: "font-medium text-muted-foreground",
      },
    },
    defaultVariants: {
      priority: "medium",
    },
  }
);

interface MultiDayTaskBarProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof multiDayBarVariants> {
  task: TaskTransport;
  onEdit?: (task: TaskTransport) => void;
  startCol: number;
  span: number;
}

export function MultiDayTaskBar({ task, onEdit, startCol, span, className, ...props }: MultiDayTaskBarProps) {
  return (
    <div
      onClick={() => onEdit?.(task)}
      className={cn(multiDayBarVariants({ priority: task.effectivePriority }), className)}
      style={{
        gridColumn: `${startCol} / span ${span}`,
      }}
      {...props}
    >
      <div className="min-w-0 flex-1 truncate">
        {task.title}
      </div>
      <div className="shrink-0 text-[0.7rem] font-normal text-muted-foreground tabular-nums">
        {task.startDate && task.dueDate && `${shortDate(task.startDate)} a ${shortDate(task.dueDate)}`}
      </div>
    </div>
  );
}
