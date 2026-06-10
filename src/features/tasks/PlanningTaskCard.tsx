"use client";

import { differenceInCalendarDays, format, isBefore, startOfToday } from "date-fns";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "./tasks.types";
import { parseDueDate } from "./tasks.utils";
import { getTaskTypeConfig } from "./task-type-config";

interface PlanningTaskCardProps {
  task: Task;
  isFocused?: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (task: Task) => void;
  onEdit?: (task: Task) => void;
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
  const isArchived = task.status === "archived";
  const isCritical = task.priority === "critical" && !isDone && !isArchived;
  const isHigh = task.priority === "high" && !isDone && !isArchived;
  const isEvent = task.taskType === "event";
  const typeConfig = getTaskTypeConfig(task.taskType);
  const TypeIcon = typeConfig.icon;

  const isOverdue =
    !!task.dueDate && !isDone && !isArchived && isBefore(parseDueDate(task.dueDate), startOfToday());
  const dueDays = task.dueDate
    ? differenceInCalendarDays(parseDueDate(task.dueDate), startOfToday())
    : null;
  const isDueSoon = dueDays !== null && dueDays >= 0 && dueDays <= 2;

  return (
    <div
      className={cn(
        "group/card relative rounded-lg border px-2 py-1.5 motion-safe:transition-colors",
        !isCritical && !isHigh && !isFocused && "bg-[#1a1a1e] border-white/[0.07] hover:border-white/[0.16]",
        isCritical && "bg-[rgba(188,38,38,0.12)] border-[rgba(220,50,50,0.32)]",
        isHigh && "bg-[rgba(180,90,20,0.12)] border-[rgba(230,115,30,0.32)]",
        isFocused && "bg-[rgba(99,102,241,0.08)] border-[rgba(99,102,241,0.6)]",
        isDone && "opacity-45",
        isArchived && "opacity-35",
      )}
    >
      <div className="flex items-start gap-1.5">
        {/* Toggle */}
        <button
          type="button"
          onClick={() => !isArchived && onToggle(task.id)}
          disabled={isArchived}
          aria-label={isDone ? "Marcar como pendiente" : "Marcar como completada"}
          className={cn(
            "relative mt-px size-3.5 shrink-0 rounded-full border-2 flex items-center justify-center",
            "after:absolute after:inset-[-8px] after:content-['']",
            isDone || isArchived
              ? "border-[#3ecf72] bg-[#3ecf72] text-[#0e0e10]"
              : isCritical
                ? "border-[rgba(220,80,80,0.5)] hover:border-[#e05555]"
                : isHigh
                  ? "border-[rgba(230,115,30,0.5)] hover:border-[#e6731e]"
                  : "border-white/25 hover:border-white/50",
          )}
        >
          {(isDone || isArchived) && <CheckIcon />}
        </button>

        {/* Título */}
        <button
          type="button"
          onClick={() => onEdit?.(task)}
          className={cn(
            "flex-1 min-w-0 text-left text-xs leading-snug text-zinc-200 line-clamp-2",
            isDone && "line-through text-zinc-500",
          )}
        >
          {task.title}
        </button>

        {/* Eliminar (hover) */}
        <button
          type="button"
          onClick={() => onDelete(task)}
          className="shrink-0 -mr-0.5 text-zinc-600 hover:text-red-400 opacity-0 group-hover/card:opacity-100 motion-safe:transition-opacity"
          aria-label="Eliminar tarea"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Meta: tipo (eventos) + fecha */}
      {(isEvent || task.dueDate) && (
        <div className="mt-1 flex items-center gap-1.5 pl-5 flex-wrap">
          {isEvent && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#7dd3fc]">
              <TypeIcon size={11} />
              {typeConfig.label}
            </span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                "font-mono text-[10px]",
                isOverdue ? "text-[#f87171]" : isDueSoon ? "text-[#fbbf24]" : "text-zinc-500",
              )}
            >
              {isOverdue ? "vencida" : "vence"} · {format(parseDueDate(task.dueDate), "MMM d")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
