import React from "react";
import { format } from "date-fns";
import type { TaskTransport } from "./tasks.types";
import { parseDueDate } from "./tasks.utils";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const multiDayBarVariants = cva(
  "flex items-center gap-2 px-2 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors shadow-sm border",
  {
    variants: {
      priority: {
        critical: "bg-task-overdue/10 text-task-overdue border-task-overdue/20 hover:bg-task-overdue/20",
        high: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20",
        medium: "bg-secondary text-foreground border-secondary hover:bg-secondary",
        low: "bg-muted text-muted-foreground border-muted hover:bg-muted",
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
      className={cn(multiDayBarVariants({ priority: task.priority }), className)}
      style={{
        gridColumn: `${startCol} / span ${span}`,
      }}
      {...props}
    >
      <div className="truncate flex-1 font-semibold">
        {task.title}
      </div>
      <div className="shrink-0 text-[10px] opacity-70">
        {task.startDate && task.dueDate && (
          `${format(parseDueDate(task.startDate), "MMM d")} - ${format(parseDueDate(task.dueDate), "MMM d")}`
        )}
      </div>
    </div>
  );
}
