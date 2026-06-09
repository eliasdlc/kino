"use client";

import { cn } from "@/lib/utils";
import { format, differenceInCalendarDays } from "date-fns";
import { parseDueDate } from "@/features/tasks/tasks.utils";
import { Pencil, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getTaskTypeConfig } from "@/features/tasks/task-type-config";
import type { LinkedTask } from "./pages.types";

// ── Status badge colors (subset of TaskCard's palette) ──
const STATUS_BADGE: Record<string, string> = {
  backlog: "bg-zinc-800/50 text-zinc-400",
  week: "bg-sky-950/50 text-sky-400",
  tomorrow: "bg-amber-950/50 text-amber-400",
  today: "bg-emerald-950/50 text-emerald-400",
  done: "bg-green-950/50 text-green-500",
  archived: "bg-zinc-800/40 text-zinc-500",
};

// ── Priority colors ──
const PRIORITY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-zinc-400",
  low: "text-zinc-500",
};

interface LinkedTaskCardProps {
  task: LinkedTask;
  onToggle: () => void;
  onEdit: () => void;
  onUnlink: () => void;
}

export function LinkedTaskCard({ task, onToggle, onEdit, onUnlink }: LinkedTaskCardProps) {
  const isDone = task.status === "done";
  const isArchived = task.status === "archived";
  const typeConfig = getTaskTypeConfig(task.taskType ?? undefined);

  // Due date urgency
  const dueInfo = (() => {
    if (!task.dueDate) return null;
    const days = differenceInCalendarDays(parseDueDate(task.dueDate), new Date());
    const label = format(parseDueDate(task.dueDate), "MMM d");
    if (days < 0) return { label: `Overdue · ${label}`, color: "text-red-400" };
    if (days === 0) return { label: `Today · ${label}`, color: "text-red-400" };
    if (days === 1) return { label: `Tomorrow · ${label}`, color: "text-amber-400" };
    if (days <= 3) return { label: `${label} · in ${days}d`, color: "text-amber-400" };
    return { label, color: "text-zinc-500" };
  })();

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border transition-colors",
        isDone || isArchived
          ? "bg-zinc-900/30 border-white/[0.04] opacity-60"
          : "bg-[#1a1a1e] border-white/[0.07] hover:bg-[#1e1e23] hover:border-white/[0.13]"
      )}
    >
      {/* Row 1: checkbox + title + actions */}
      <div className="flex items-start gap-2">
        {/* Toggle checkbox */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={isDone ? "Mark as pending" : "Mark as completed"}
          className={cn(
            "mt-0.5 size-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors",
            isDone
              ? "border-green-500 bg-green-500"
              : "border-zinc-600 hover:border-primary"
          )}
        >
          {isDone && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2 6 5 9 10 3" />
            </svg>
          )}
        </button>

        {/* Title */}
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            "flex-1 text-sm font-normal text-zinc-200 truncate text-left leading-snug",
            isDone && "line-through text-zinc-500"
          )}
        >
          {task.title}
        </button>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-0.5 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onEdit}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-all"
                  aria-label="Edit task"
                >
                  <Pencil className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Edit task</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onUnlink}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-destructive transition-all"
                  aria-label="Unlink task"
                >
                  <X className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Unlink task</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Row 2: meta badges */}
      <div className="flex items-center gap-1.5 flex-wrap pl-7">
        {/* Type badge */}
        {task.taskType && (
          <span className={cn(
            "inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-px rounded",
            typeConfig.pillClass
          )}>
            {typeConfig.label}
          </span>
        )}

        {/* Status badge */}
        <span className={cn(
          "font-mono text-xs font-medium px-1.5 py-px rounded",
          STATUS_BADGE[task.status] ?? STATUS_BADGE.backlog
        )}>
          {task.status}
        </span>

        {/* Priority — only show for high/critical */}
        {(task.priority === "critical" || task.priority === "high") && (
          <span className={cn(
            "font-mono text-xs font-semibold uppercase",
            PRIORITY_COLOR[task.priority]
          )}>
            {task.priority}
          </span>
        )}

        {/* Due date */}
        {dueInfo && (
          <>
            <span className="text-xs text-zinc-700">·</span>
            <span className={cn("font-mono text-xs", dueInfo.color)}>
              {dueInfo.label}
            </span>
          </>
        )}

        {/* Estimated time */}
        {task.estimatedTime && (
          <>
            <span className="text-xs text-zinc-700">·</span>
            <span className="font-mono text-xs text-zinc-500">
              {task.estimatedTime}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
