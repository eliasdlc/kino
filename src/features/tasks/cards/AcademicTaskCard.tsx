"use client";

import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSystemColor } from "@/shared/utils/system-colors";
import { getTaskKind } from "@/shared/lib/system-types";
import { parseDueDate } from "../tasks.utils";
import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";
import type { TaskCardState } from "./useTaskCard";
import type { Task } from "../tasks.types";

/** Countdown compacto: un examen se define por cuánto falta. */
function Countdown({ task, state }: { task: Task; state: TaskCardState }) {
  if (!task.dueDate) return null;
  const label = format(parseDueDate(task.dueDate), "MMM d");
  const days = state.dueDays;
  const text = state.isOverdue
    ? "vencida"
    : days === 0
      ? "hoy"
      : days === 1
        ? "mañana"
        : days != null
          ? `en ${days} días`
          : label;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs md:text-sm",
        state.isOverdue ? "text-[#f87171] font-medium" : state.isDueSoon ? "text-[#fbbf24]" : "text-zinc-500",
      )}
    >
      <CalendarClock size={13} />
      {text} · {label}
    </span>
  );
}

/**
 * Académico — la card muestra lo que importa en una clase: qué clase (chip del
 * folder con su color), qué kind de tarea (entrega/examen…) y el countdown a la
 * entrega. Compone la fila base vía renderMeta.
 */
function AcademicMeta({ task, state }: { task: Task; state: TaskCardState }) {
  const kind = getTaskKind("academic", (task.metadata as Record<string, unknown> | null)?.kind);
  const KindIcon = kind?.icon;
  const { folder } = state;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {kind && KindIcon && (
        <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-xs md:text-sm text-zinc-300">
          <KindIcon size={13} />
          {kind.label}
        </span>
      )}

      {folder && (
        <span className="inline-flex items-center gap-1 text-xs md:text-sm text-zinc-400">
          <span className={cn("size-1.5 rounded-full shrink-0", `bg-${getSystemColor(folder.color)}`)} />
          {folder.name}
        </span>
      )}

      {task.dueDate && (
        <>
          {(kind || folder) && <span className="text-xs text-zinc-700">·</span>}
          <Countdown task={task} state={state} />
        </>
      )}
    </div>
  );
}

export function AcademicTaskCard(props: TaskCardProps) {
  return (
    <DefaultTaskCard
      {...props}
      systemType="academic"
      renderMeta={(state) => <AcademicMeta task={props.task} state={state} />}
    />
  );
}
