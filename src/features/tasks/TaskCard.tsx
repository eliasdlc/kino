"use client";

import { useState } from "react";
import { differenceInCalendarDays, format, isBefore, parseISO, startOfToday } from "date-fns";
import { BatteryLow, ChevronDown, Minus, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Task } from "./tasks.types";
import { SubtaskList } from "./SubtaskList";
import { useSubtasks } from "./tasks.hooks";
import { useFolders } from "@/features/folders/folders.hooks";
import { getSystemColor } from "@/shared/utils/system-colors";
import { getTaskTypeConfig } from "./task-type-config";

interface TaskCardProps {
  task: Task;
  systemId: string;
  isFocused?: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (task: Task) => void;
  onEdit?: (task: Task) => void;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  backlog: "outline",
  week: "secondary",
  tomorrow: "secondary",
  today: "default",
  done: "secondary",
  archived: "outline",
};

const PRIORITY_STYLES = {
  critical: "ring-1 hover:ring-2 ring-red-500 bg-red-500/10 transition-all duration-300 ease-in-out",
  high: "ring-1 hover:ring-2 ring-orange-400 bg-orange-400/10 transition-all duration-300 ease-in-out",
  overdue: "ring-1 hover:ring-2 ring-red-500 bg-red-500/10 transition-all duration-300 ease-in-out",
} as const;


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

function ReminderCountdown({ dueDate }: { dueDate: string }) {
  const days = differenceInCalendarDays(parseISO(dueDate), startOfToday());
  let label: string;
  let colorClass: string;

  if (days < 0) {
    label = `Overdue by ${Math.abs(days)}d`;
    colorClass = "text-red-500 font-medium";
  } else if (days === 0) {
    label = "Due today";
    colorClass = "text-red-500 font-medium";
  } else if (days === 1) {
    label = "Due tomorrow";
    colorClass = "text-amber-500 font-medium";
  } else if (days <= 3) {
    label = `In ${days} days`;
    colorClass = "text-amber-500";
  } else {
    label = `In ${days} days`;
    colorClass = "text-muted-foreground";
  }

  return <span className={cn("text-[10px]", colorClass)}>{label}</span>;
}

function SubtaskCount({ parentTaskId, systemId }: { parentTaskId: string; systemId: string }) {
  const { data: subtasks } = useSubtasks(parentTaskId, systemId);
  if (!subtasks || subtasks.length === 0) return null;
  const done = subtasks.filter((s) => s.status === "done").length;
  return (
    <span className="text-[10px] text-muted-foreground">
      {done}/{subtasks.length} subtasks
    </span>
  );
}

export function TaskCard({ task, systemId, isFocused, onToggle, onDelete, onEdit }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDone = task.status === "done";
  const isArchived = task.status === "archived";
  const isCritical = task.priority === "critical" && !isArchived && !isDone;
  const isHigh = task.priority === "high" && !isArchived && !isDone;
  const isOverdue =
    !!task.dueDate &&
    !isDone &&
    !isArchived &&
    isBefore(parseISO(task.dueDate), startOfToday());

  const { data: folders } = useFolders(systemId);
  const folder = task.folderId ? folders?.find((f) => f.id === task.folderId) : null;
  const typeConfig = getTaskTypeConfig(task.taskType);
  const TypeIcon = typeConfig.icon;

  return (
    <div
      className={cn(
        "group flex items-start gap-3 px-3 py-2.5 rounded-md border bg-card transition-all hover:shadow-sm",
        isDone && "opacity-60",
        (isCritical) && PRIORITY_STYLES.critical,
        (isHigh) && PRIORITY_STYLES.high,
        (isOverdue) && PRIORITY_STYLES.overdue,
        isArchived && "opacity-60",
        isFocused && "ring-2 ring-primary border-transparent"
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
          <button
            type="button"
            onClick={() => onEdit?.(task)}
            className={cn(
              "text-sm font-medium truncate text-left hover:underline underline-offset-2",
              isDone && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </button>
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
              onClick={() => onDelete(task)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              aria-label="Delete task"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Row 2: chips */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {/* Task type badge (only when type is set) */}
          {task.taskType && (
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
              typeConfig.pillClass
            )}>
              <TypeIcon size={10} />
              {typeConfig.label}
            </span>
          )}

          {/* Status badge */}
          <Badge variant={STATUS_VARIANT[task.status] ?? "outline"} className="text-[11px] px-1.5 py-0">
            {task.status}
          </Badge>

          {/* Energy chip (hidden for idea/reminder) */}
          {!typeConfig.hideEnergyLevel && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <EnergyIcon level={task.energyLevel} />
              {task.energyLevel}
            </span>
          )}

          {/* Folder chip */}
          {folder && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`size-1.5 rounded-full inline-block shrink-0 ${getSystemColor(folder.color).dot}`} />
              {folder.name}
            </span>
          )}

          {/* Reminder: countdown instead of raw date */}
          {task.taskType === "reminder" && task.dueDate ? (
            <ReminderCountdown dueDate={task.dueDate} />
          ) : task.dueDate ? (
            <span
              className={cn(
                "text-[10px]",
                isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
              )}
            >
              {isOverdue ? "Overdue · " : "Due · "}
              {format(parseISO(task.dueDate), "MMM d")}
            </span>
          ) : null}

          {/* Project: subtask count */}
          {task.taskType === "project" && (
            <SubtaskCount parentTaskId={task.id} systemId={systemId} />
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
