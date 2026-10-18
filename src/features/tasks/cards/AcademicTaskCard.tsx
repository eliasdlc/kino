"use client";

import { getTaskKind } from "@/shared/lib/system-types";
import { dueMeta } from "../task-vocab";
import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";
import type { TaskCardState } from "./useTaskCard";
import type { TaskTransport } from "../tasks.types";

/**
 * Académico. La meta dice lo que importa en una clase: qué tipo de tarea
 * (entrega, examen), de qué clase (la carpeta) y cuánto falta. Una entrega se
 * define por la fecha: "vence en 3 días" dice más que el día del mes, y
 * vencida va en coral con la fecha detrás.
 */
function academicMeta(task: TaskTransport, state: TaskCardState): React.ReactNode[] {
  const kind = getTaskKind("academic", (task.metadata as Record<string, unknown> | null)?.kind);
  const parts: React.ReactNode[] = [];
  if (kind) parts.push(kind.label.toLowerCase());
  if (state.folder) parts.push(state.folder.name);
  if (task.dueDate) {
    const due = dueMeta(task.dueDate, state.isDone);
    const days = state.dueDays;
    parts.push(
      due.overdue ? (
        <span key="due">
          <b className="font-semibold text-task-overdue">vencida</b> {due.when}
        </span>
      ) : days !== null && days > 1 ? (
        `vence en ${days} días`
      ) : (
        `vence ${due.when}`
      ),
    );
  }
  return parts;
}

export function AcademicTaskCard(props: TaskCardProps) {
  return <DefaultTaskCard {...props} systemType="academic" metaParts={(state) => academicMeta(props.task, state)} />;
}
