"use client";

import { differenceInCalendarDays, format, isBefore, startOfToday } from "date-fns";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskTransport } from "./tasks.types";
import { parseDueDate } from "./tasks.utils";
import { getTaskTypeConfig } from "./task-type-config";
import { useSubtasks } from "./tasks.hooks";

// KIN-80: compact subtask count for the planning card
function SubtaskCount({ taskId, systemId }: { taskId: string; systemId: string }) {
  const { data: subtasks } = useSubtasks(taskId, systemId);
  if (!subtasks || subtasks.length === 0) return null;
  const done = subtasks.filter((s) => s.status === "done").length;
  return (
    <span className="font-mono text-[10px] text-muted-foreground/65">
      {done}/{subtasks.length}
    </span>
  );
}

interface PlanningTaskCardProps {
  task: TaskTransport;
  isFocused?: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (task: TaskTransport) => void;
  onEdit?: (task: TaskTransport) => void;
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 6 5 9 10 3" />
    </svg>
  );
}

/**
 * Versión compacta del card para las columnas semanales de Planificación, donde
 * cada columna mide ~1/7 del ancho. El TaskCard completo se ve desproporcionado
 * y la info no se lee; aquí mostramos solo lo esencial: toggle, título y fecha.
 */
export function PlanningTaskCard({ task, isFocused, onToggle, onDelete, onEdit }: PlanningTaskCardProps) {
  const isDone = task.status === "done";
  const isCritical = task.priority === "critical" && !isDone;
  const isHigh = task.priority === "high" && !isDone;
  const isEvent = task.taskType === "event";
  const typeConfig = getTaskTypeConfig(task.taskType, task.metadata);
  const TypeIcon = typeConfig.icon;

  const isOverdue =
    !!task.dueDate && !isDone && isBefore(parseDueDate(task.dueDate), startOfToday());
  const dueDays = task.dueDate
    ? differenceInCalendarDays(parseDueDate(task.dueDate), startOfToday())
    : null;
  const isDueSoon = dueDays !== null && dueDays >= 0 && dueDays <= 2;

  return (
    <div
      className={cn(
        "group/card relative rounded-lg border px-2 py-1.5 motion-safe:transition-colors",
        !isCritical && !isHigh && !isFocused && "bg-card border-border hover:border-foreground/25",
        isCritical && "bg-task-critical/[0.12] border-task-critical/32",
        isHigh && "bg-task-high/[0.12] border-task-high/32",
        isFocused && "bg-primary/8 border-primary/60",
        isDone && "opacity-45",
      )}
    >
      <div className="flex items-start gap-1.5">
        {/* Toggle */}
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          aria-label={isDone ? "Marcar como pendiente" : "Marcar como completada"}
          className={cn(
            "relative mt-px size-3.5 shrink-0 rounded-full border-2 flex items-center justify-center",
            "after:absolute after:inset-[-8px] after:content-['']",
            isDone
              ? "border-task-done bg-task-done text-task-done-foreground"
              : isCritical
                ? "border-task-critical/50 hover:border-task-critical"
                : isHigh
                  ? "border-task-high/50 hover:border-task-high"
                  : "border-muted-foreground/40 hover:border-muted-foreground/70",
          )}
        >
          {isDone && <CheckIcon />}
        </button>

        {/* Título */}
        <button
          type="button"
          onClick={() => onEdit?.(task)}
          className={cn(
            "flex-1 min-w-0 text-left text-xs leading-snug text-foreground line-clamp-2",
            isDone && "line-through text-muted-foreground/85",
          )}
        >
          {task.title}
        </button>

        {/* Eliminar (hover) */}
        <button
          type="button"
          onClick={() => onDelete(task)}
          className="shrink-0 -mr-0.5 text-muted-foreground/65 hover:text-destructive opacity-0 group-hover/card:opacity-100 motion-safe:transition-opacity"
          aria-label="Eliminar tarea"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Meta: tipo (eventos) + fecha + subtask count (KIN-80) */}
      {(isEvent || task.dueDate) && (
        <div className="mt-1 flex items-center gap-1.5 pl-5 flex-wrap">
          {isEvent && (
            <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium", typeConfig.iconClass)}>
              <TypeIcon size={11} />
              {typeConfig.label}
            </span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                "font-mono text-[10px]",
                isOverdue ? "text-task-overdue" : isDueSoon ? "text-task-due-soon" : "text-muted-foreground/85",
              )}
            >
              {isOverdue ? "vencida" : "vence"} · {format(parseDueDate(task.dueDate), "MMM d")}
            </span>
          )}
          <SubtaskCount taskId={task.id} systemId={task.systemId} />
        </div>
      )}
      {/* Show subtask count even when there's no date/event meta */}
      {!isEvent && !task.dueDate && (
        <div className="mt-0.5 pl-5">
          <SubtaskCount taskId={task.id} systemId={task.systemId} />
        </div>
      )}
    </div>
  );
}
