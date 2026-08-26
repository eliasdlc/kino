"use client";

import { Target } from "lucide-react";
import { getTaskKind } from "@/shared/lib/system-types";
import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";
import type { TaskCardState } from "./useTaskCard";
import type { TaskTransport } from "../tasks.types";

/**
 * Emprendimiento — la card ancla la tarea a su milestone (folder) y su kind
 * (experimento/build/learning), con la hipótesis en una línea. Se prioriza el
 * "por qué" del experimento sobre la fecha.
 */
function EntrepreneurialMeta({ task, state }: { task: TaskTransport; state: TaskCardState }) {
  const kind = getTaskKind("entrepreneurial", (task.metadata as Record<string, unknown> | null)?.kind);
  const KindIcon = kind?.icon;
  const hypothesis = (task.metadata as Record<string, unknown> | null)?.hypothesis;
  const { folder } = state;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap text-xs md:text-sm text-muted-foreground">
        {kind && KindIcon && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-foreground/85">
            <KindIcon size={13} />
            {kind.label}
          </span>
        )}
        {folder && (
          <span className="inline-flex items-center gap-1">
            <Target size={13} className="text-primary" />
            {folder.name}
          </span>
        )}
      </div>
      {typeof hypothesis === "string" && hypothesis.trim() && (
        <p className="text-xs text-muted-foreground/85 truncate">{hypothesis}</p>
      )}
    </div>
  );
}

export function EntrepreneurialTaskCard(props: TaskCardProps) {
  return (
    <DefaultTaskCard
      {...props}
      systemType="entrepreneurial"
      renderMeta={(state) => <EntrepreneurialMeta task={props.task} state={state} />}
    />
  );
}
