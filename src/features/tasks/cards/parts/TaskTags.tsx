import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTaskTypeConfig } from "../../task-type-config";
import type { TaskTransport } from "../../tasks.types";

/**
 * Paleta de los tags del board (ver mockup de `ProjectTaskCard`).
 *
 * Los hex del mockup se pintaron contra fondo negro, así que se quedan en la
 * variante `dark:` y el tema claro usa el mismo tono en su paso legible sobre
 * blanco. En oscuro no cambia ni un valor.
 */
const PRIORITY_TAG: Record<string, { className: string; label: string }> = {
  critical: { className: "bg-task-overdue/12 text-task-overdue dark:bg-[#3b2224] dark:text-[#d55e62]", label: "Crítica" },
  high: { className: "bg-task-overdue/12 text-task-overdue dark:bg-[#3b2224] dark:text-[#d55e62]", label: "Alta" },
  medium: { className: "bg-primary/12 text-primary dark:bg-[#392a1e] dark:text-[#d58d4e]", label: "Media" },
  low: { className: "bg-task-done/12 text-task-done dark:bg-[#1c3329] dark:text-[#4ed583]", label: "Baja" },
};

const ENERGY_LABEL: Record<string, string> = {
  high: "Energía alta",
  medium: "Energía media",
  low: "Energía baja",
  flexible: "Flexible",
};

/**
 * La prioridad que cuenta. Cuando la fecha la subió por encima de la elegida,
 * lo dice con una flecha y un título: «Crítica» sola haría creer que se eligió
 * así, y la elección sigue siendo la otra.
 */
export function PriorityTag({ priority, chosen }: { priority: string | null; chosen?: string | null }) {
  const tag = PRIORITY_TAG[priority ?? "medium"] ?? PRIORITY_TAG.medium;
  const raised = chosen != null && chosen !== priority;
  const elegida = raised ? (PRIORITY_TAG[chosen] ?? PRIORITY_TAG.medium).label.toLowerCase() : null;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium", tag.className)}
      title={raised ? `Subió por la fecha. La elegiste ${elegida}.` : undefined}
    >
      {raised ? (
        <ArrowUp className="size-3" aria-hidden />
      ) : (
        <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: "currentColor" }} />
      )}
      {tag.label}
      {raised && <span className="sr-only">, subió por la fecha; la elegiste {elegida}</span>}
    </span>
  );
}

export function TaskTypeTag({ taskType, metadata }: { taskType: string | null, metadata?: Record<string, unknown> | null }) {
  if (!taskType) return null;
  const config = getTaskTypeConfig(taskType, metadata);
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-foreground dark:bg-[#222b40] dark:text-[#6888d3]">
      {config.label}
    </span>
  );
}

export function EnergyTag({ energyLevel }: { energyLevel: string | null }) {
  if (!energyLevel) return null;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary/12 text-primary dark:bg-[#2d223b] dark:text-[#b068d3]">
      {ENERGY_LABEL[energyLevel] ?? energyLevel}
    </span>
  );
}

/** Fila de tags del ticket: prioridad + tipo + energía. */
export function TaskTags({ task }: { task: TaskTransport }) {
  const config = getTaskTypeConfig(task.taskType, task.metadata);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <PriorityTag priority={task.effectivePriority} chosen={task.priority} />
      <TaskTypeTag taskType={task.taskType} metadata={task.metadata} />
      {!config.hideEnergyAndPriority && <EnergyTag energyLevel={task.energyLevel} />}
    </div>
  );
}
