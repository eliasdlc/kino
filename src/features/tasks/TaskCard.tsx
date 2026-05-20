"use client";

import { useState } from "react";
import { differenceInCalendarDays, format, isBefore, parseISO, startOfToday } from "date-fns";
import { ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
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

const STATUS_BADGE: Record<string, string> = {
  backlog:  "bg-white/[0.06] text-zinc-400",
  week:     "bg-[rgba(99,102,241,0.18)] text-[#a5b4fc]",
  today:    "bg-[rgba(16,185,129,0.18)] text-[#6ee7b7]",
  tomorrow: "bg-[rgba(245,158,11,0.18)] text-[#fcd34d]",
  done:     "bg-[rgba(62,207,114,0.14)] text-[#6ee7b7]",
  archived: "bg-white/[0.05] text-zinc-600",
};

const TYPE_BADGE: Record<string, string> = {
  todo:     "bg-white/[0.06] text-zinc-400",
  idea:     "bg-[rgba(245,158,11,0.15)] text-[#fbbf24]",
  reminder: "bg-[rgba(249,115,22,0.15)] text-[#fb923c]",
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
  const days = differenceInCalendarDays(parseISO(dueDate), startOfToday());

  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm text-[#f87171] font-medium">
        <ClockIcon />
        overdue · {format(parseISO(dueDate), "MMM d")}
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm text-[#f87171] font-medium">
        <ClockIcon />
        due · today · {format(parseISO(dueDate), "MMM d")}
      </span>
    );
  }
  if (days === 1) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm text-[#fbbf24]">
        <CalendarIcon />
        due · tomorrow · {format(parseISO(dueDate), "MMM d")}
      </span>
    );
  }
  if (days <= 2) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm text-[#fbbf24]">
        <CalendarIcon />
        {format(parseISO(dueDate), "MMM d")} · in {days} days
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-[3px] font-mono text-xs text-zinc-500">
      <CalendarIcon />
      due · {format(parseISO(dueDate), "MMM d")}
    </span>
  );
}

function SubtaskProgress({ parentTaskId, systemId }: { parentTaskId: string; systemId: string }) {
  const { data: subtasks } = useSubtasks(parentTaskId, systemId);
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

export function TaskCard({ task, systemId, isFocused, onToggle, onDelete, onEdit }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);

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

  const showPriorityBadge = (isCritical || isHigh) && !isDone && !isArchived;

  const dueDays = task.dueDate && !isOverdue
    ? differenceInCalendarDays(parseISO(task.dueDate), startOfToday())
    : null;
  const isDueSoon = dueDays !== null && dueDays <= 2;

  function handleToggle() {
    if (!isDone && !isArchived) {
      setCompleting(true);
      setTimeout(() => setCompleting(false), 550);
    }
    onToggle(task.id);
  }

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3.5 px-4 py-3.5 rounded-xl border motion-safe:transition-[border-color,background] motion-safe:duration-150",
        !isCritical && !isHigh && !isFocused && "bg-[#1a1a1e] border-white/[0.07] hover:bg-[#1e1e23] hover:border-white/[0.13]",
        isCritical && "bg-[rgba(188,38,38,0.13)] border-[rgba(220,50,50,0.35)] hover:border-[rgba(220,50,50,0.55)] hover:bg-[rgba(188,38,38,0.18)]",
        isHigh && "bg-[rgba(180,90,20,0.13)] border-[rgba(230,115,30,0.35)] hover:border-[rgba(230,115,30,0.55)] hover:bg-[rgba(180,90,20,0.18)]",
        isDone && "opacity-45",
        isArchived && "opacity-35",
        isFocused && "bg-[rgba(99,102,241,0.08)] border-[rgba(99,102,241,0.6)]"
      )}
    >
      {/* Toggle */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isDone ? "Mark as pending" : "Mark as completed"}
        className={cn(
          "mt-0.5 size-6 shrink-0 rounded-full border-2 flex items-center justify-center",
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

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: title + actions */}
        <div className={cn("flex items-center justify-between gap-2 mb-[5px]", showPriorityBadge && "pr-12")}>
          <button
            type="button"
            onClick={() => onEdit?.(task)}
            className={cn(
              "text-base font-normal text-zinc-200 truncate text-left leading-snug",
              isDone && "line-through text-zinc-500"
            )}
          >
            {task.title}
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="opacity-0 group-hover:opacity-100 motion-safe:transition-opacity text-zinc-500 hover:text-zinc-200"
              aria-label={isExpanded ? "Hide subtasks" : "Show subtasks"}
            >
              <ChevronDown size={18} className={cn("motion-safe:transition-transform", isExpanded && "rotate-180")} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(task)}
              className="opacity-0 group-hover:opacity-100 motion-safe:transition-opacity text-zinc-500 hover:text-red-400"
              aria-label="Delete task"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Row 2: primary meta chips — always visible */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type badge */}
          {task.taskType && (
            <span className={cn(
              "inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-md",
              TYPE_BADGE[task.taskType] ?? TYPE_BADGE.todo
            )}>
              <TypeIcon size={13} />
              {typeConfig.label}
            </span>
          )}

          {/* Status badge */}
          <span className={cn(
            "font-mono text-sm font-medium px-2 py-0.5 rounded-md tracking-[0.02em]",
            STATUS_BADGE[task.status] ?? STATUS_BADGE.backlog
          )}>
            {task.status}
          </span>

          {/* Date chip — always visible (urgency signal) */}
          {task.taskType === "reminder" && task.dueDate ? (
            <>
              <span className="text-sm text-zinc-700">·</span>
              <ReminderCountdown dueDate={task.dueDate} />
            </>
          ) : task.dueDate ? (
            <>
              <span className="text-sm text-zinc-700">·</span>
              <span className={cn(
                "inline-flex items-center gap-1 font-mono text-sm",
                isOverdue ? "text-[#f87171] font-medium" : isDueSoon ? "text-[#fbbf24]" : "text-zinc-500"
              )}>
                {isOverdue ? <ClockIcon /> : <CalendarIcon />}
                {isOverdue ? "overdue" : "due"} · {format(parseISO(task.dueDate), "MMM d")}
              </span>
            </>
          ) : null}

          {/* Subtask progress — always visible for projects */}
          {task.taskType === "project" && (
            <>
              <span className="text-xs text-zinc-700">·</span>
              <SubtaskProgress parentTaskId={task.id} systemId={systemId} />
            </>
          )}

          {/* Secondary chips — visible on hover to reduce noise */}
          <span className={cn(
            "inline-flex items-center gap-1.5 flex-wrap",
            "opacity-0 group-hover:opacity-100 motion-safe:transition-opacity motion-safe:duration-150"
          )}>
            {/* Folder chip */}
            {folder && (
              <>
                <span className="text-xs text-zinc-700">·</span>
                <span className="inline-flex items-center gap-1 text-sm text-zinc-500">
                  <span className={cn("size-1.5 rounded-full shrink-0", getSystemColor(folder.color).dot)} />
                  {folder.name}
                </span>
              </>
            )}

            {/* Energy chip */}
            {!typeConfig.hideEnergyLevel && (
              <>
                <span className="text-xs text-zinc-700">·</span>
                <span className="font-mono text-sm text-zinc-600">{task.energyLevel}</span>
              </>
            )}

            {/* Estimated time */}
            {task.estimatedTime && (
              <>
                <span className="text-xs text-zinc-700">·</span>
                <span className="font-mono text-sm text-zinc-500">
                  {formatTime(task.estimatedTime)}
                </span>
              </>
            )}
          </span>
        </div>

        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <SubtaskList parentTaskId={task.id} systemId={systemId} />
          </div>
        )}
      </div>

      {/* Priority corner badge */}
      {showPriorityBadge && (
        <span className={cn(
          "absolute top-2.5 right-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded",
          isCritical ? "bg-[rgba(220,50,50,0.2)] text-[#f87171]" : "bg-[rgba(230,115,30,0.2)] text-[#fb923c]"
        )}>
          {isCritical ? "critical" : "high"}
        </span>
      )}
    </div>
  );
}
