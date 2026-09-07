"use client";

import { differenceInCalendarDays, format, startOfToday } from "date-fns";
import { parseDueDate } from "../tasks.utils";
import { ChevronDown, Trash2, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskTransport, TaskMetadata } from "../tasks.types";
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
  /** Personal, la card que no grita prioridad: sin badge ni bordes rojo/naranja. */
  soft?: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  backlog:  "bg-muted text-muted-foreground",
  week:     "bg-primary/15 text-primary",
  today:    "bg-task-done/18 text-task-done",
  tomorrow: "bg-primary/18 text-primary",
  done:     "bg-task-done/15 text-task-done",
  archived: "bg-muted/60 text-muted-foreground/65",
};

const TYPE_BADGE: Record<string, string> = {
  task:     "bg-muted text-muted-foreground",
  idea:     "bg-primary/15 text-primary",
  event:    "bg-secondary text-foreground",
  reminder: "bg-primary/15 text-primary",
  epic:     "bg-primary/18 text-primary",
  habit:    "bg-primary/15 text-primary",
  todo:     "bg-muted text-muted-foreground",
  project:  "bg-secondary text-foreground",
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
      <span className="inline-flex items-center gap-1 font-mono text-sm text-task-overdue font-medium">
        <ClockIcon />
        vencida · {format(parseDueDate(dueDate), "MMM d")}
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm text-task-overdue font-medium">
        <ClockIcon />
        vence · hoy · {format(parseDueDate(dueDate), "MMM d")}
      </span>
    );
  }
  if (days === 1) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm text-task-due-soon">
        <CalendarIcon />
        vence · mañana · {format(parseDueDate(dueDate), "MMM d")}
      </span>
    );
  }
  if (days <= 2) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm text-task-due-soon">
        <CalendarIcon />
        {format(parseDueDate(dueDate), "MMM d")} · en {days} días
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-[3px] font-mono text-xs text-muted-foreground/85">
      <CalendarIcon />
      vence · {format(parseDueDate(dueDate), "MMM d")}
    </span>
  );
}

// KIN-77: always fetch subtasks so progress is visible without expanding the card.
// Returns null (no dot) when there are no subtasks, so non-parent tasks pay zero render cost.
function SubtaskProgress({ parentTaskId, systemId }: { parentTaskId: string; systemId: string }) {
  const { data: subtasks } = useSubtasks(parentTaskId, systemId);
  if (!subtasks || subtasks.length === 0) return null;
  const done = subtasks.filter((s) => s.status === "done").length;
  const pct = Math.round((done / subtasks.length) * 100);
  return (
    <>
      <span className="text-xs text-muted-foreground/45">·</span>
      <span className="inline-flex items-center gap-1.5 font-mono text-sm text-muted-foreground/85">
        <span className="inline-flex h-1 w-12 rounded-full bg-muted-foreground/30 overflow-hidden">
          <span
            className="h-full bg-task-done rounded-full motion-safe:transition-all motion-safe:duration-300"
            style={{ width: `${pct}%` }}
          />
        </span>
        {done}/{subtasks.length}
      </span>
    </>
  );
}

interface DefaultMetaProps {
  task: TaskTransport;
  state: TaskCardState;
  systemType?: SystemType;
  systemId: string;
}

function DefaultMeta({ task, state, systemType, systemId }: DefaultMetaProps) {
  const { isOverdue, isDueSoon, folder, typeConfig } = state;
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
          <span className="text-sm text-muted-foreground/45">·</span>
          <ReminderCountdown dueDate={task.dueDate} />
        </>
      ) : task.dueDate ? (
        <>
          <span className="text-sm text-muted-foreground/45">·</span>
          <span className={cn(
            "inline-flex items-center gap-1 font-mono text-xs md:text-sm",
            isOverdue ? "text-task-overdue font-medium" : isDueSoon ? "text-task-due-soon" : "text-muted-foreground/85"
          )}>
            {isOverdue ? <ClockIcon /> : <CalendarIcon />}
            {isOverdue ? "vencida" : "vence"} · {format(parseDueDate(task.dueDate), "MMM d")}
          </span>
        </>
      ) : null}

      {/* KIN-77: show for all task types, not just project */}
      <SubtaskProgress parentTaskId={task.id} systemId={systemId} />

      <span className={cn(
        "inline-flex items-center gap-1.5 flex-wrap",
        "md:opacity-0 md:group-hover:opacity-100 motion-safe:transition-opacity motion-safe:duration-150"
      )}>
        {folder && (
          <>
            <span className="text-xs text-muted-foreground/45">·</span>
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground/85">
              <span className={cn("size-1.5 rounded-full shrink-0", `bg-${getSystemColor(folder.color)}`)} />
              {folder.name}
            </span>
          </>
        )}

        {!typeConfig.hideEnergyAndPriority && (
          <>
            <span className="text-xs text-muted-foreground/45">·</span>
            <span className="font-mono text-sm text-muted-foreground/65">{task.energyLevel}</span>
          </>
        )}

        {task.estimatedTime && (
          <>
            <span className="text-xs text-muted-foreground/45">·</span>
            <span className="font-mono text-sm text-muted-foreground/85">
              {formatTime(task.estimatedTime)}
            </span>
          </>
        )}

        {systemType && task.metadata && (() => {
          const m = task.metadata as TaskMetadata;
          if (systemType === "academic" && m.course) return (
            <>
              <span className="text-xs text-muted-foreground/45">·</span>
              <span className="text-sm text-muted-foreground/85">{m.course}</span>
            </>
          );
          if (systemType === "project" && (m.assignee || m.project)) return (
            <>
              {m.project && <><span className="text-xs text-muted-foreground/45">·</span><span className="text-sm text-muted-foreground/85">{m.project}</span></>}
              {m.assignee && <><span className="text-xs text-muted-foreground/45">·</span><span className="text-sm text-muted-foreground/85">{m.assignee}</span></>}
            </>
          );
          if (systemType === "entrepreneurial" && m.milestone) return (
            <>
              <span className="text-xs text-muted-foreground/45">·</span>
              <span className="text-sm text-muted-foreground/85">{m.milestone}</span>
            </>
          );
          return null;
        })()}
      </span>

      {systemType === "personal" && (task.metadata as TaskMetadata | null)?.why && (
        <p className="text-xs text-muted-foreground/65 mt-0.5 truncate">
          {(task.metadata as TaskMetadata).why}
        </p>
      )}
    </div>
  );
}

export function DefaultTaskCard({ task, systemId, systemType, draggable, isFocused, onToggle, onDelete, onEdit, renderMeta, isSelected, onSelectionToggle, soft }: DefaultTaskCardProps) {
  const state = useTaskCard(task, systemId, onToggle);
  const {
    isDone, completing,
    isThisRunning, anotherRunning, isExpanded, setIsExpanded,
    handleToggle, openModeDialog,
  } = state;
  // En modo soft (personal) la prioridad no tiñe la card ni muestra badge.
  const isCritical = state.isCritical && !soft;
  const isHigh = state.isHigh && !soft;
  const showPriorityBadge = state.showPriorityBadge && !soft;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <div
      className={cn(
        "group relative flex items-start gap-3 px-3.5 py-3 md:gap-3.5 md:px-4 md:py-3.5 rounded-xl border motion-safe:transition-[border-color,background] motion-safe:duration-150",
        !isCritical && !isHigh && !isFocused && !isSelected && "bg-card border-border hover:bg-accent hover:border-foreground/20",
        isCritical && "bg-task-critical/[0.13] border-task-critical/35 hover:border-task-critical/55 hover:bg-task-critical/[0.18]",
        isHigh && "bg-task-high/[0.13] border-task-high/35 hover:border-task-high/55 hover:bg-task-high/[0.18]",
        isDone && "opacity-45",
        isFocused && "bg-primary/8 border-primary/60",
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
              : "border-muted-foreground/40 bg-transparent md:opacity-0 md:group-hover:opacity-100 hover:border-primary/70",
          )}
          aria-label={isSelected ? "Deseleccionar" : "Seleccionar"}
        >
          {isSelected && <Check size={11} />}
        </button>
      )}

      <button
        type="button"
        onClick={handleToggle}
        aria-label={isDone ? "Marcar como pendiente" : "Marcar como completada"}
        className={cn(
          "relative mt-0.5 size-6 shrink-0 rounded-full border-2 flex items-center justify-center",
          "after:absolute after:inset-[-10px] after:content-['']",
          "motion-safe:transition-[colors,transform,box-shadow] motion-safe:duration-200",
          completing && "motion-safe:scale-125 motion-safe:shadow-[0_0_0_5px_color-mix(in_oklab,var(--task-done)_20%,transparent)]",
          isDone
            ? "border-task-done bg-task-done text-task-done-foreground"
            : isCritical
            ? "border-task-critical/50 hover:border-task-critical"
            : isHigh
            ? "border-task-high/50 hover:border-task-high"
            : "border-muted-foreground/40 hover:border-muted-foreground/70"
        )}
      >
        {isDone && <CheckIcon />}
      </button>

      <div className="flex-1 min-w-0">
        <div className={cn("flex items-center justify-between gap-2 mb-[5px]", showPriorityBadge && "pr-12")}>
          <button
            type="button"
            onClick={() => onEdit?.(task)}
            className={cn(
              "text-sm md:text-base font-normal text-foreground truncate text-left leading-snug",
              isDone && "line-through text-muted-foreground/85"
            )}
          >
            {task.title}
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            {!isDone && (
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
                    ? "text-primary md:opacity-100"
                    : anotherRunning
                      ? "text-muted-foreground/45 cursor-not-allowed"
                      : "text-muted-foreground/85 hover:text-primary dark:hover:text-primary",
                )}
                aria-label={isThisRunning ? "Timer en curso" : "Iniciar foco"}
              >
                <Timer size={16} className={cn(isThisRunning && "")} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="md:opacity-0 md:group-hover:opacity-100 motion-safe:transition-opacity text-muted-foreground/85 hover:text-foreground"
              aria-label={isExpanded ? "Ocultar subtareas" : "Mostrar subtareas"}
            >
              <ChevronDown size={18} className={cn("motion-safe:transition-transform", isExpanded && "rotate-180")} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(task)}
              className="md:opacity-0 md:group-hover:opacity-100 motion-safe:transition-opacity text-muted-foreground/85 hover:text-destructive"
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
          <div className="mt-2 pt-2 border-t border-border">
            <SubtaskList parentTaskId={task.id} systemId={systemId} />
          </div>
        )}
      </div>

      {showPriorityBadge && (
        <span className={cn(
          "absolute top-2.5 right-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded",
          isCritical ? "bg-task-critical/20 text-task-overdue" : "bg-task-high/20 text-task-high-foreground"
        )}>
          {isCritical ? "critical" : "high"}
        </span>
      )}
    </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {!isDone && (
          <>
            <ContextMenuItem
              disabled={anotherRunning}
              onSelect={() => openModeDialog({ id: task.id, title: task.title, systemId, estimatedDuration: task.estimatedTime ? (() => { const [h, m] = task.estimatedTime!.split(":").map(Number); return h * 60 + m; })() : null })}
            >
              <Timer className={cn("mr-2 size-4", isThisRunning && "text-primary")} />
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
