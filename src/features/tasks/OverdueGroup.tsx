"use client";

import { useState } from "react";
import { isBefore, startOfToday } from "date-fns";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBulkMove } from "./tasks.hooks";
import { parseDueDate } from "./tasks.utils";
import { TaskListRow } from "./TaskListRow";
import type { TaskTransport } from "./tasks.types";

interface OverdueGroupProps {
  tasks: TaskTransport[];
  systemMap: Map<string, { id: string; name: string; color: string | null }>;
  onOpen: (task: TaskTransport) => void;
  onToggle: (taskId: string) => void;
}

const ACTIVE_STATUSES = new Set(["backlog", "week", "tomorrow", "today", "planning", "action"]);

const MOVES = [
  { status: "today", label: "Hoy" },
  { status: "tomorrow", label: "Mañana" },
  { status: "week", label: "Semana" },
] as const;

export function getOverdueTasks(tasks: TaskTransport[]): TaskTransport[] {
  const today = startOfToday();
  return tasks.filter(
    (t) =>
      t.dueDate &&
      ACTIVE_STATUSES.has(t.status) &&
      isBefore(parseDueDate(t.dueDate), today)
  );
}

/**
 * Las vencidas, arriba de la lista, con las mismas filas que el resto. La
 * cabecera es una fila: el título con la cuenta a la izquierda y, a la
 * derecha, mover todas de golpe. En laptop las tres acciones caben; en el
 * teléfono van en un menú para no pisar el título.
 */
export function OverdueGroup({ tasks, systemMap, onOpen, onToggle }: OverdueGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { mutate: bulkMove, isPending } = useBulkMove();

  if (tasks.length === 0) return null;

  const ids = tasks.map((t) => t.id);

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", collapsed && "-rotate-90")} />
          <span className="truncate text-sm font-semibold">Pendientes de antes</span>
          <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
        </button>

        <div className="hidden items-center gap-1.5 md:flex">
          <span className="text-xs text-muted-foreground">Mover a</span>
          {MOVES.map(({ status, label }) => (
            <Button
              key={status}
              size="xs"
              variant="secondary"
              disabled={isPending}
              onClick={() => bulkMove({ taskIds: ids, status })}
            >
              {label}
            </Button>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-xs" variant="ghost" className="md:hidden" aria-label="Mover todas" disabled={isPending}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {MOVES.map(({ status, label }) => (
              <DropdownMenuItem key={status} onSelect={() => bulkMove({ taskIds: ids, status })}>
                Mover todas a {label.toLowerCase()}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!collapsed && (
        <div className="divide-y divide-border">
          {tasks.map((t) => (
            <TaskListRow key={t.id} task={t} systemMap={systemMap} onToggle={onToggle} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
