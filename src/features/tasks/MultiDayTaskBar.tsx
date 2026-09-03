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
        critical: "bg-red-500/10 text-red-700 border-red-500/20 hover:bg-red-500/20 dark:text-red-400",
        high: "bg-orange-500/10 text-orange-700 border-orange-500/20 hover:bg-orange-500/20 dark:text-orange-400",
        medium: "bg-blue-500/10 text-blue-700 border-blue-500/20 hover:bg-blue-500/20 dark:text-blue-400",
        low: "bg-neutral-500/10 text-neutral-700 border-neutral-500/20 hover:bg-neutral-500/20 dark:text-neutral-400",
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
