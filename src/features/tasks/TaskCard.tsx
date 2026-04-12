"use client";

import { useState } from "react";
import { isBefore, parseISO, startOfToday } from "date-fns";
import { BatteryLow, ChevronDown, Minus, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Task } from "./tasks.types";
import { SubtaskList } from "./SubtaskList";

interface TaskCardProps {
  task: Task;
  systemId: string;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  backlog: "outline",
  week: "secondary",
  today: "default",
  done: "secondary",
  archived: "outline",
};


function EnergyIcon({ level }: { level: string }) {
  if (level === "high") return <Zap size={12} />;
  if (level === "low") return <BatteryLow size={12} />;
  return <Minus size={12} />;
}

function formatTime(timeStr: unknown): string {
  if (typeof timeStr !== 'string') return '';
  const [h, m] = timeStr.split(':').map(Number);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function TaskCard({ task, systemId, onToggle, onDelete }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDone = task.status === "done";
  const isArchived = task.status === "archived" ;
  const isCritical = task.priority === "critical" && !isArchived && !isDone;
  const isHigh = task.priority === "high" && !isArchived && !isDone;
  const isOverdue =
    task.dueDate !== null &&
    !isDone && !isArchived &&
    isBefore(parseISO(task.dueDate), startOfToday()) && !isArchived;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 px-3 py-2.5 rounded-md border bg-card transition-all hover:shadow-sm",
        isDone && "opacity-60",
        (isCritical ) && " ring-1 hover:ring-2 ring-red-500 bg-red-500/10 transition-all duration-300 ease-in-out",
        (isHigh ) && " ring-1 hover:ring-2 ring-orange-400 bg-orange-400/10 transition-all duration-300 ease-in-out",
        (isOverdue ) && " ring-1 hover:ring-2 ring-red-500 animate-pulse bg-red-500/10 transition-all duration-300 ease-in-out",
        isArchived && "opacity-60"
      )}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        aria-label={isDone ? "Mark as pending" : "Mark as completed"}
        className={cn(
          "mt-0.5 size-4 shrink-0 rounded-full border-2 transition-colors",
          isDone || isArchived
            ? "border-green-500 bg-green-500"
            : "border-muted-foreground/40 hover:border-primary"
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
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              aria-label={isExpanded ? "Hide subtasks" : "Show subtasks"}
            >
              <ChevronDown
                size={16}
                className={cn("transition-transform", isExpanded && "rotate-180")}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete "${task.title}"?`)) onDelete(task.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              aria-label="Delete task"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Row 2: chips */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {/* Status badge */}
          <Badge variant={STATUS_VARIANT[task.status] ?? "outline"} className="text-[10px] px-1.5 py-0">
            {task.status}
          </Badge>

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
              {isOverdue ? "Overdue: " : ""}
              {task.dueDate}
            </span>
          )}

          {/* Estimated time */}
          {task.estimatedTime && (
            <span className="text-[10px] text-muted-foreground">
              {formatTime(task.estimatedTime)}
            </span>
          )}
        </div>

        {isExpanded && (
          <div className="mt-2 pt-2 border-t">
            <SubtaskList parentTaskId={task.id} systemId={systemId} />
          </div>
        )}
      </div>
    </div>
  );
}
