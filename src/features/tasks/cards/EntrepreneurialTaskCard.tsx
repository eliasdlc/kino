"use client";

import { getTaskKind } from "@/shared/lib/system-types";
import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";
import type { TaskCardState } from "./useTaskCard";
import type { TaskTransport } from "../tasks.types";

/**
 * Emprendimiento: la meta ancla la tarea a su hito (la carpeta) y a su tipo
 * (experimento, construir, aprender), con la hipótesis detrás. Se prioriza el
 * porqué del experimento sobre la fecha.
 */
function entrepreneurialMeta(task: TaskTransport, state: TaskCardState): React.ReactNode[] {
  const kind = getTaskKind("entrepreneurial", (task.metadata as Record<string, unknown> | null)?.kind);
  const hypothesis = (task.metadata as Record<string, unknown> | null)?.hypothesis;
  const parts: React.ReactNode[] = [];
  if (kind) parts.push(kind.label.toLowerCase());
  if (state.folder) parts.push(state.folder.name);
  if (typeof hypothesis === "string" && hypothesis.trim()) {
    parts.push(<span key="hipotesis" className="font-voice italic">{hypothesis.trim()}</span>);
  }
  return parts;
}

export function EntrepreneurialTaskCard(props: TaskCardProps) {
  return (
    <DefaultTaskCard
      {...props}
      systemType="entrepreneurial"
      metaParts={(state) => entrepreneurialMeta(props.task, state)}
    />
  );
}
