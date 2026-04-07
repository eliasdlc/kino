"use client";

import { isBefore, parseISO, startOfToday } from "date-fns";
import { BatteryLow, Minus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "./tasks.types";

interface TaskCardProps {
  task: Task;
  onToggle: (taskId: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  backlog:  "bg-slate-100 text-slate-600",
  week:     "bg-blue-100 text-blue-700",
  today:    "bg-amber-100 text-amber-700",
  done:     "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-500",
};

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-400",
  medium:   "bg-yellow-400",
  low:      "bg-slate-300",
};

function EnergyIcon({ level }: { level: string }) {
  if (level === "high")   return <Zap size={12} />;
  if (level === "low")    return <BatteryLow size={12} />;
  return <Minus size={12} />;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function TaskCard({ task, onToggle }: TaskCardProps) {
  const isDone = task.status === "done";
  const isOverdue =
    task.dueDate !== null &&
    !isDone &&
    isBefore(parseISO(task.dueDate), startOfToday());

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 rounded-md border bg-card transition-opacity",
        isDone && "opacity-60"
      )}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        aria-label={isDone ? "Marcar como pendiente" : "Marcar como completado"}
        className={cn(
          "mt-0.5 size-4 shrink-0 rounded-full border-2 transition-colors",
          isDone
            ? "border-green-500 bg-green-500"
            : "border-muted-foreground/40 hover:border-green-400"
        )}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: title + priority */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate",
              isDone && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
          <span
            className={cn(
              "size-2 rounded-full shrink-0",
              PRIORITY_DOT[task.priority] ?? "bg-slate-300"
            )}
            title={task.priority}
          />
        </div>

        {/* Row 2: chips */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {/* Status badge */}
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
              STATUS_STYLES[task.status] ?? "bg-slate-100 text-slate-600"
            )}
          >
            {task.status}
          </span>

          {/* Energy chip */}
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <EnergyIcon level={task.energyLevel} />
            {task.energyLevel}
          </span>

          {/* Due date */}
          {task.dueDate && (
            <span
              className={cn(
                "text-[10px]",
                isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
              )}
            >
              {isOverdue ? "Vencida: " : ""}
              {task.dueDate}
            </span>
          )}

          {/* Estimated time */}
          {task.estimatedMinutes && (
            <span className="text-[10px] text-muted-foreground">
              {formatMinutes(task.estimatedMinutes)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
