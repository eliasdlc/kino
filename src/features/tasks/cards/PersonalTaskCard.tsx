"use client";

import { Repeat } from "lucide-react";
import { getTaskKind } from "@/shared/lib/system-types";
import { describeRecurrence } from "../recurrence";
import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";
import type { TaskCardState } from "./useTaskCard";
import type { Task } from "../tasks.types";

/**
 * Personal — fila suave: sin prioridad agresiva (soft), muestra el kind
 * (hábito/recado/evento), la recurrencia si la hay y la franja de energía. Lo
 * que importa aquí es la constancia, no la urgencia.
 */
function PersonalMeta({ task }: { task: Task; state: TaskCardState }) {
  const kind = getTaskKind("personal", (task.metadata as Record<string, unknown> | null)?.kind);
  const KindIcon = kind?.icon;
  const recurrence = task.recurrenceRule ? describeRecurrence(task.recurrenceRule) : null;

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs md:text-sm text-zinc-400">
      {kind && KindIcon && (
        <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-zinc-300">
          <KindIcon size={13} />
          {kind.label}
        </span>
      )}
      {recurrence && (
        <span className="inline-flex items-center gap-1 text-[#d8b4fe]">
          <Repeat size={13} />
          {recurrence}
        </span>
      )}
      <span className="font-mono text-zinc-500">{task.energyLevel}</span>
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
