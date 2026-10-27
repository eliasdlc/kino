"use client";

import { getTaskKind } from "@/shared/lib/system-types";
import { describeRecurrence } from "../recurrence";
import { energyMeta } from "../task-vocab";
import { DefaultTaskCard } from "./DefaultTaskCard";
import type { TaskCardProps } from "./types";
import type { TaskTransport } from "../tasks.types";

/**
 * Personal, la fila suave: sin prioridad (soft). La meta dice el tipo
 * (hábito, recado, evento), la repetición si la hay y la energía. Lo que
 * importa aquí es la constancia, no la urgencia.
 */
function personalMeta(task: TaskTransport): React.ReactNode[] {
  const kind = getTaskKind("personal", (task.metadata as Record<string, unknown> | null)?.kind);
  const recurrence = task.recurrenceRule ? describeRecurrence(task.recurrenceRule) : null;
  const parts: React.ReactNode[] = [];
  if (kind) parts.push(kind.label.toLowerCase());
  if (recurrence) parts.push(recurrence);
  parts.push(energyMeta(task.energyLevel));
  return parts;
}

export function PersonalTaskCard(props: TaskCardProps) {
  return <DefaultTaskCard {...props} systemType="personal" soft metaParts={() => personalMeta(props.task)} />;
}
