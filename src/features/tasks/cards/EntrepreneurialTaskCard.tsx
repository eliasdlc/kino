"use client";

import { Target } from "lucide-react";
import { getTaskKind } from "@/shared/lib/system-types";
import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";
import type { TaskCardState } from "./useTaskCard";
import type { Task } from "../tasks.types";

/**
 * Emprendimiento — la card ancla la tarea a su milestone (folder) y su kind
 * (experimento/build/learning), con la hipótesis en una línea. Se prioriza el
 * "por qué" del experimento sobre la fecha.
 */
function EntrepreneurialMeta({ task, state }: { task: Task; state: TaskCardState }) {
  const kind = getTaskKind("entrepreneurial", (task.metadata as Record<string, unknown> | null)?.kind);
  const KindIcon = kind?.icon;
  const hypothesis = (task.metadata as Record<string, unknown> | null)?.hypothesis;
  const { folder } = state;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap text-xs md:text-sm text-zinc-400">
        {kind && KindIcon && (
          <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-zinc-300">
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
        <p className="text-xs text-zinc-500 truncate">{hypothesis}</p>
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
