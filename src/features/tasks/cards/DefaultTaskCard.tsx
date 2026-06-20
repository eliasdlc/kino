"use client";

import { differenceInCalendarDays, format, startOfToday } from "date-fns";
import { parseDueDate } from "../tasks.utils";
import { ChevronDown, Trash2, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskMetadata } from "../tasks.types";
import { SubtaskList } from "../SubtaskList";
import { useSubtasks } from "../tasks.hooks";
import { getSystemColor } from "@/shared/utils/system-colors";
import { useTaskCard, type TaskCardState } from "./useTaskCard";
import type { TaskCardProps } from "./types";
import type { SystemType } from "@/shared/lib/system-types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Check } from "lucide-react";

export type { TaskCardState };

interface DefaultTaskCardProps extends TaskCardProps {
  systemType?: SystemType;
  renderMeta?: (state: TaskCardState) => React.ReactNode;
  isSelected?: boolean;
  onSelectionToggle?: (taskId: string) => void;
}

const STATUS_BADGE: Record<string, string> = {
  backlog:  "bg-white/[0.06] text-zinc-400",
  week:     "bg-[rgba(99,102,241,0.18)] text-[#a5b4fc]",
  today:    "bg-[rgba(16,185,129,0.18)] text-[#6ee7b7]",
  tomorrow: "bg-[rgba(245,158,11,0.18)] text-[#fcd34d]",
  done:     "bg-[rgba(62,207,114,0.14)] text-[#6ee7b7]",
  archived: "bg-white/[0.05] text-zinc-600",
};

const TYPE_BADGE: Record<string, string> = {
  task:     "bg-white/[0.06] text-zinc-400",
  idea:     "bg-[rgba(245,158,11,0.15)] text-[#fbbf24]",
  event:    "bg-[rgba(14,165,233,0.15)] text-[#7dd3fc]",
  reminder: "bg-[rgba(249,115,22,0.15)] text-[#fb923c]",
  epic:     "bg-[rgba(139,92,246,0.18)] text-[#c4b5fd]",
  habit:    "bg-[rgba(168,85,247,0.15)] text-[#d8b4fe]",
  todo:     "bg-white/[0.06] text-zinc-400",
  project:  "bg-[rgba(59,130,246,0.18)] text-[#93c5fd]",
};

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 6 5 9 10 3" />
    </svg>
  );
}

function formatTime(timeStr: unknown): string {
  if (typeof timeStr !== "string") return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function ReminderCountdown({ dueDate }: { dueDate: string }) {
  const days = differenceInCalendarDays(parseDueDate(dueDate), startOfToday());

  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm text-[#f87171] font-medium">
        <ClockIcon />
        vencida · {format(parseDueDate(dueDate), "MMM d")}
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm text-[#f87171] font-medium">
        <ClockIcon />
        vence · hoy · {format(parseDueDate(dueDate), "MMM d")}
      </span>
    );
  }
  if (days === 1) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm text-[#fbbf24]">
        <CalendarIcon />
        vence · mañana · {format(parseDueDate(dueDate), "MMM d")}
      </span>
    );
  }
  if (days <= 2) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm text-[#fbbf24]">
        <CalendarIcon />
        {format(parseDueDate(dueDate), "MMM d")} · en {days} días
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-[3px] font-mono text-xs text-zinc-500">
      <CalendarIcon />
      vence · {format(parseDueDate(dueDate), "MMM d")}
    </span>
  );
}

function SubtaskProgress({ parentTaskId, systemId, isExpanded }: { parentTaskId: string; systemId: string; isExpanded: boolean }) {
  const { data: subtasks } = useSubtasks(parentTaskId, systemId, { enabled: isExpanded });
  if (!subtasks || subtasks.length === 0) return null;
  const done = subtasks.filter((s) => s.status === "done").length;
  const pct = subtasks.length > 0 ? Math.round((done / subtasks.length) * 100) : 0;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-sm text-zinc-500">
      <span className="inline-flex h-1 w-12 rounded-full bg-zinc-700/80 overflow-hidden">
        <span
          className="h-full bg-[#3ecf72] rounded-full motion-safe:transition-all motion-safe:duration-300"
          style={{ width: `${pct}%` }}
        />
      </span>
      {done}/{subtasks.length}
    </span>
  );
}

interface DefaultMetaProps {
  task: Task;
  state: TaskCardState;
  systemType?: SystemType;
  systemId: string;
}

function DefaultMeta({ task, state, systemType, systemId }: DefaultMetaProps) {
  const { isOverdue, isDueSoon, folder, typeConfig, isExpanded } = state;
  const TypeIcon = typeConfig.icon;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {task.taskType && (
        <span className={cn(
          "inline-flex items-center gap-1 text-xs md:text-sm font-medium px-2 py-0.5 rounded-md",
          TYPE_BADGE[task.taskType] ?? TYPE_BADGE.todo
        )}>
          <TypeIcon size={13} />
          {typeConfig.label}
        </span>
      )}

      <span className={cn(
        "font-mono text-xs md:text-sm font-medium px-2 py-0.5 rounded-md tracking-[0.02em]",
        STATUS_BADGE[task.status] ?? STATUS_BADGE.backlog
      )}>
        {task.status}
      </span>

      {task.taskType === "reminder" && task.dueDate ? (
        <>
          <span className="text-sm text-zinc-700">·</span>
          <ReminderCountdown dueDate={task.dueDate} />
        </>
      ) : task.dueDate ? (
        <>
          <span className="text-sm text-zinc-700">·</span>
          <span className={cn(
            "inline-flex items-center gap-1 font-mono text-xs md:text-sm",
            isOverdue ? "text-[#f87171] font-medium" : isDueSoon ? "text-[#fbbf24]" : "text-zinc-500"
          )}>
            {isOverdue ? <ClockIcon /> : <CalendarIcon />}
            {isOverdue ? "vencida" : "vence"} · {format(parseDueDate(task.dueDate), "MMM d")}
          </span>
        </>
      ) : null}

      {task.taskType === "project" && (
        <>
          <span className="text-xs text-zinc-700">·</span>
          <SubtaskProgress parentTaskId={task.id} systemId={systemId} isExpanded={isExpanded} />
        </>
      )}

      <span className={cn(
        "inline-flex items-center gap-1.5 flex-wrap",
        "md:opacity-0 md:group-hover:opacity-100 motion-safe:transition-opacity motion-safe:duration-150"
      )}>
        {folder && (
          <>
            <span className="text-xs text-zinc-700">·</span>
            <span className="inline-flex items-center gap-1 text-sm text-zinc-500">
              <span className={cn("size-1.5 rounded-full shrink-0", `bg-${getSystemColor(folder.color)}`)} />
              {folder.name}
            </span>
          </>
        )}

        {!typeConfig.hideEnergyAndPriority && (
          <>
            <span className="text-xs text-zinc-700">·</span>
            <span className="font-mono text-sm text-zinc-600">{task.energyLevel}</span>
          </>
        )}

        {task.estimatedTime && (
          <>
            <span className="text-xs text-zinc-700">·</span>
            <span className="font-mono text-sm text-zinc-500">
              {formatTime(task.estimatedTime)}
            </span>
          </>
        )}

        {systemType && task.metadata && (() => {
          const m = task.metadata as TaskMetadata;
          if (systemType === "academic" && m.course) return (
            <>
              <span className="text-xs text-zinc-700">·</span>
              <span className="text-sm text-zinc-500">{m.course}</span>
            </>
          );
          if (systemType === "project" && (m.assignee || m.project)) return (
            <>
              {m.project && <><span className="text-xs text-zinc-700">·</span><span className="text-sm text-zinc-500">{m.project}</span></>}
              {m.assignee && <><span className="text-xs text-zinc-700">·</span><span className="text-sm text-zinc-500">{m.assignee}</span></>}
            </>
          );
          if (systemType === "entrepreneurial" && m.milestone) return (
            <>
              <span className="text-xs text-zinc-700">·</span>
              <span className="text-sm text-zinc-500">{m.milestone}</span>
            </>
          );
          return null;
        })()}
      </span>

      {systemType === "personal" && (task.metadata as TaskMetadata | null)?.why && (
        <p className="text-xs text-zinc-600 mt-0.5 truncate">
          {(task.metadata as TaskMetadata).why}
        </p>
      )}
    </div>
  );
}

export function DefaultTaskCard({ task, systemId, systemType, draggable, isFocused, onToggle, onDelete, onEdit, renderMeta, isSelected, onSelectionToggle }: DefaultTaskCardProps) {
  const state = useTaskCard(task, systemId, onToggle);
  const {
    isDone, isArchived, isCritical, isHigh, completing,
    isThisRunning, anotherRunning, isExpanded, setIsExpanded,
    showPriorityBadge, handleToggle, openModeDialog,
  } = state;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <div
      className={cn(
        "group relative flex items-start gap-3 px-3.5 py-3 md:gap-3.5 md:px-4 md:py-3.5 rounded-xl border motion-safe:transition-[border-color,background] motion-safe:duration-150",
        !isCritical && !isHigh && !isFocused && !isSelected && "bg-[#1a1a1e] border-white/[0.07] hover:bg-[#1e1e23] hover:border-white/[0.13]",
        isCritical && "bg-[rgba(188,38,38,0.13)] border-[rgba(220,50,50,0.35)] hover:border-[rgba(220,50,50,0.55)] hover:bg-[rgba(188,38,38,0.18)]",
        isHigh && "bg-[rgba(180,90,20,0.13)] border-[rgba(230,115,30,0.35)] hover:border-[rgba(230,115,30,0.55)] hover:bg-[rgba(180,90,20,0.18)]",
        isDone && "opacity-45",
        isArchived && "opacity-35",
        isFocused && "bg-[rgba(99,102,241,0.08)] border-[rgba(99,102,241,0.6)]",
        isSelected && !isCritical && !isHigh && "bg-primary/5 border-primary/40",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      {onSelectionToggle && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSelectionToggle(task.id); }}
          className={cn(
            "mt-0.5 size-5 shrink-0 rounded border-2 flex items-center justify-center motion-safe:transition-[colors,opacity]",
            isSelected
              ? "border-primary bg-primary text-primary-foreground opacity-100"
              : "border-white/25 bg-transparent md:opacity-0 md:group-hover:opacity-100 hover:border-primary/70",
          )}
          aria-label={isSelected ? "Deseleccionar" : "Seleccionar"}
        >
          {isSelected && <Check size={11} />}
        </button>
      )}

      <button
        type="button"
        onClick={handleToggle}
        disabled={isArchived}
        aria-label={isDone ? "Marcar como pendiente" : "Marcar como completada"}
        className={cn(
          "relative mt-0.5 size-6 shrink-0 rounded-full border-2 flex items-center justify-center",
          isArchived && "cursor-default",
          "after:absolute after:inset-[-10px] after:content-['']",
          "motion-safe:transition-[colors,transform,box-shadow] motion-safe:duration-200",
          completing && "motion-safe:scale-125 motion-safe:shadow-[0_0_0_5px_rgba(62,207,114,0.2)]",
          isDone || isArchived
            ? "border-[#3ecf72] bg-[#3ecf72] text-[#0e0e10]"
            : isCritical
            ? "border-[rgba(220,80,80,0.5)] hover:border-[#e05555]"
            : isHigh
            ? "border-[rgba(230,115,30,0.5)] hover:border-[#e6731e]"
            : "border-white/25 hover:border-white/50"
        )}
      >
        {(isDone || isArchived) && <CheckIcon />}
      </button>

      <div className="flex-1 min-w-0">
        <div className={cn("flex items-center justify-between gap-2 mb-[5px]", showPriorityBadge && "pr-12")}>
          <button
            type="button"
            onClick={() => onEdit?.(task)}
            className={cn(
              "text-sm md:text-base font-normal text-zinc-200 truncate text-left leading-snug",
              isDone && "line-through text-zinc-500"
            )}
          >
            {task.title}
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isDone && !isArchived && (
              <button
                type="button"
                onClick={() => !anotherRunning && openModeDialog({
                  id: task.id,
                  title: task.title,
                  systemId,
                  estimatedDuration: task.estimatedTime
                    ? (() => { const [h, m] = task.estimatedTime!.split(':').map(Number); return h * 60 + m; })()
                    : null,
                })}
                disabled={anotherRunning}
                className={cn(
                  "md:opacity-0 md:group-hover:opacity-100 motion-safe:transition-opacity",
                  isThisRunning
                    ? "text-amber-400 md:opacity-100"
                    : anotherRunning
                      ? "text-zinc-700 cursor-not-allowed"
                      : "text-zinc-500 hover:text-amber-400",
                )}
                aria-label={isThisRunning ? "Timer en curso" : "Iniciar foco"}
              >
                <Timer size={16} className={cn(isThisRunning && "animate-pulse")} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="md:opacity-0 md:group-hover:opacity-100 motion-safe:transition-opacity text-zinc-500 hover:text-zinc-200"
              aria-label={isExpanded ? "Ocultar subtareas" : "Mostrar subtareas"}
            >
              <ChevronDown size={18} className={cn("motion-safe:transition-transform", isExpanded && "rotate-180")} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(task)}
              className="md:opacity-0 md:group-hover:opacity-100 motion-safe:transition-opacity text-zinc-500 hover:text-red-400"
              aria-label="Eliminar tarea"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {renderMeta
          ? renderMeta(state)
          : <DefaultMeta task={task} state={state} systemType={systemType} systemId={systemId} />
        }

        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <SubtaskList parentTaskId={task.id} systemId={systemId} />
          </div>
        )}
      </div>

      {showPriorityBadge && (
        <span className={cn(
          "absolute top-2.5 right-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded",
          isCritical ? "bg-[rgba(220,50,50,0.2)] text-[#f87171]" : "bg-[rgba(230,115,30,0.2)] text-[#fb923c]"
        )}>
          {isCritical ? "critical" : "high"}
        </span>
      )}
    </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {!isDone && !isArchived && (
          <>
            <ContextMenuItem
              disabled={anotherRunning}
              onSelect={() => openModeDialog({ id: task.id, title: task.title, systemId, estimatedDuration: task.estimatedTime ? (() => { const [h, m] = task.estimatedTime!.split(":").map(Number); return h * 60 + m; })() : null })}
            >
              <Timer className={cn("mr-2 size-4", isThisRunning && "text-amber-400")} />
              {isThisRunning ? "Timer en curso" : "Iniciar foco"}
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem variant="destructive" onSelect={() => onDelete(task)}>
          <Trash2 className="mr-2 size-4" />
          Eliminar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
