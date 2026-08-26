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
  critical: { className: "bg-red-500/12 text-red-700 dark:bg-[#3b2224] dark:text-[#d55e62]", label: "Crítica" },
  high: { className: "bg-red-500/12 text-red-700 dark:bg-[#3b2224] dark:text-[#d55e62]", label: "Alta" },
  medium: { className: "bg-orange-500/12 text-orange-700 dark:bg-[#392a1e] dark:text-[#d58d4e]", label: "Media" },
  low: { className: "bg-emerald-500/12 text-emerald-700 dark:bg-[#1c3329] dark:text-[#4ed583]", label: "Baja" },
};

const ENERGY_LABEL: Record<string, string> = {
  high: "Energía alta",
  medium: "Energía media",
  low: "Energía baja",
  flexible: "Flexible",
};

export function PriorityTag({ priority }: { priority: string | null }) {
  const tag = PRIORITY_TAG[priority ?? "medium"] ?? PRIORITY_TAG.medium;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium", tag.className)}>
      <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: "currentColor" }} />
      {tag.label}
    </span>
  );
}

export function TaskTypeTag({ taskType, metadata }: { taskType: string | null, metadata?: Record<string, unknown> | null }) {
  if (!taskType) return null;
  const config = getTaskTypeConfig(taskType, metadata);
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/12 text-blue-700 dark:bg-[#222b40] dark:text-[#6888d3]">
      {config.label}
    </span>
  );
}

export function EnergyTag({ energyLevel }: { energyLevel: string | null }) {
  if (!energyLevel) return null;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/12 text-purple-700 dark:bg-[#2d223b] dark:text-[#b068d3]">
      {ENERGY_LABEL[energyLevel] ?? energyLevel}
    </span>
  );
}

/** Fila de tags del ticket: prioridad + tipo + energía. */
export function TaskTags({ task }: { task: TaskTransport }) {
  const config = getTaskTypeConfig(task.taskType, task.metadata);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <PriorityTag priority={task.priority} />
      <TaskTypeTag taskType={task.taskType} metadata={task.metadata} />
      {!config.hideEnergyAndPriority && <EnergyTag energyLevel={task.energyLevel} />}
    </div>
  );
}
