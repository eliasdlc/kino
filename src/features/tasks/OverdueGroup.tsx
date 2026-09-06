"use client";

import { useState } from "react";
import { isBefore, startOfToday } from "date-fns";
import { ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBulkMove } from "./tasks.hooks";
import { parseDueDate } from "./tasks.utils";
import type { TaskTransport } from "./tasks.types";

interface OverdueGroupProps {
  tasks: TaskTransport[];
  systemMap: Map<string, { id: string; name: string; color: string | null }>;
  onOpen: (task: TaskTransport) => void;
  onToggle: (taskId: string) => void;
}

const ACTIVE_STATUSES = new Set(["backlog", "week", "tomorrow", "today", "planning", "action"]);

export function getOverdueTasks(tasks: TaskTransport[]): TaskTransport[] {
  const today = startOfToday();
  return tasks.filter(
    (t) =>
      t.dueDate &&
      ACTIVE_STATUSES.has(t.status) &&
      isBefore(parseDueDate(t.dueDate), today)
  );
}

export function OverdueGroup({ tasks, systemMap, onOpen, onToggle }: OverdueGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { mutate: bulkMove, isPending } = useBulkMove();

  if (tasks.length === 0) return null;

  const ids = tasks.map((t) => t.id);

  return (
    <div className="border-b border-border/50">
      {/* Header */}
      <div className="px-4 py-2.5 bg-amber-500/5 border-b border-amber-500/15 flex items-center justify-between gap-3">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-amber-400 shrink-0 transition-transform",
              collapsed && "-rotate-90"
            )}
          />
          <span className="text-xs font-semibold text-amber-400">
            Pendientes de antes
          </span>
          <span className="text-xs text-amber-400/60">{tasks.length}</span>
        </button>

        {/* Postpone in bulk (KIN-30) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {(["today", "tomorrow", "week"] as const).map((status) => {
            const label = status === "today" ? "Hoy" : status === "tomorrow" ? "Mañana" : "Semana";
            return (
              <button
                key={status}
                onClick={() => bulkMove({ taskIds: ids, status })}
                disabled={isPending}
                className="text-[11px] px-2 py-0.5 rounded border border-amber-500/25 text-amber-400/80 hover:bg-amber-500/10 hover:border-amber-500/50 transition-colors disabled:opacity-40"
              >
                → {label}
              </button>
            );
          })}

          {/* KIN-31: energy suggestion hook: disabled, visual only */}
          <button
            disabled
            title="Próximamente: sugerencia por energía de Kino"
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground/30 cursor-not-allowed"
          >
            <Zap className="w-3 h-3" />
            Sugerido
          </button>
        </div>
      </div>

      {/* TaskTransport rows */}
      {!collapsed && (
        <div className="divide-y divide-border/30">
          {tasks.map((t) => {
            const system = systemMap.get(t.systemId);
            return (
              <div
                key={t.id}
                className="flex items-center gap-2 px-4 py-2 hover:bg-accent/30 transition-colors group border-l-2 border-amber-500/40"
              >
                {/* Completion toggle */}
                <button
                  onClick={() => onToggle(t.id)}
                  className="w-4 h-4 rounded border shrink-0 transition-colors border-amber-500/50 hover:border-amber-500"
                  aria-label="Completar"
                />

                <button
                  onClick={() => onOpen(t)}
                  className="flex-1 min-w-0 text-left text-sm text-foreground truncate"
                >
                  {t.title}
                </button>

                <div className="flex items-center gap-2 shrink-0 text-xs">
                  {system && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">
                      {system.name}
                    </span>
                  )}
                  {t.priority && (
                    <span className="text-[11px] text-amber-400/70 font-medium uppercase">
                      {t.priority === "critical" ? "CRIT" : t.priority === "high" ? "ALTA" : t.priority === "medium" ? "MED" : "BAJA"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
