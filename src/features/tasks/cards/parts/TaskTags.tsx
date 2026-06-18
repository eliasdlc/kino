import { cn } from "@/lib/utils";
import { getTaskTypeConfig } from "../../task-type-config";
import type { Task } from "../../tasks.types";

/** Paleta de los tags del board (ver mockup de `ProjectTaskCard`). */
const PRIORITY_TAG: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-[#3b2224]", text: "text-[#d55e62]", label: "Crítica" },
  high: { bg: "bg-[#3b2224]", text: "text-[#d55e62]", label: "Alta" },
  medium: { bg: "bg-[#392a1e]", text: "text-[#d58d4e]", label: "Media" },
  low: { bg: "bg-[#1c3329]", text: "text-[#4ed583]", label: "Baja" },
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
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium", tag.bg, tag.text)}>
      <span className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: "currentColor" }} />
      {tag.label}
    </span>
  );
}

export function TaskTypeTag({ taskType }: { taskType: string | null }) {
  if (!taskType) return null;
  const config = getTaskTypeConfig(taskType);
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#222b40] text-[#6888d3]">
      {config.label}
    </span>
  );
}

export function EnergyTag({ energyLevel }: { energyLevel: string | null }) {
  if (!energyLevel) return null;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#2d223b] text-[#b068d3]">
      {ENERGY_LABEL[energyLevel] ?? energyLevel}
    </span>
  );
}

/** Fila de tags del ticket: prioridad + tipo + energía. */
export function TaskTags({ task }: { task: Task }) {
  const config = getTaskTypeConfig(task.taskType);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <PriorityTag priority={task.priority} />
      <TaskTypeTag taskType={task.taskType} />
      {!config.hideEnergyAndPriority && <EnergyTag energyLevel={task.energyLevel} />}
    </div>
  );
}
