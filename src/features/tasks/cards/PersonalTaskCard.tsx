"use client";

import { Repeat } from "lucide-react";
import { getTaskKind } from "@/shared/lib/system-types";
import { describeRecurrence } from "../recurrence";
import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";
import type { TaskCardState } from "./useTaskCard";
import type { TaskTransport } from "../tasks.types";

/**
 * Personal — fila suave: sin prioridad agresiva (soft), muestra el kind
 * (hábito/recado/evento), la recurrencia si la hay y la franja de energía. Lo
 * que importa aquí es la constancia, no la urgencia.
 */
function PersonalMeta({ task }: { task: TaskTransport; state: TaskCardState }) {
  const kind = getTaskKind("personal", (task.metadata as Record<string, unknown> | null)?.kind);
  const KindIcon = kind?.icon;
  const recurrence = task.recurrenceRule ? describeRecurrence(task.recurrenceRule) : null;

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs md:text-sm text-muted-foreground">
      {kind && KindIcon && (
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-foreground/85">
          <KindIcon size={13} />
          {kind.label}
        </span>
      )}
      {recurrence && (
        <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300">
          <Repeat size={13} />
          {recurrence}
        </span>
      )}
      <span className="font-mono text-muted-foreground/85">{task.energyLevel}</span>
    </div>
  );
}

export function PersonalTaskCard(props: TaskCardProps) {
  return (
    <DefaultTaskCard
      {...props}
      systemType="personal"
      soft
      renderMeta={(state) => <PersonalMeta task={props.task} state={state} />}
    />
  );
}
