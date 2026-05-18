import { Bell, CheckSquare, Layers, Lightbulb, type LucideIcon } from "lucide-react";
import type { TaskTypeValue } from "@/shared/types/enums";

export type TaskTypeConfig = {
  label: string;
  icon: LucideIcon;
  // Tailwind classes for the pill/badge accent
  pillClass: string;
  iconClass: string;
  // Behavior flags — drive adaptive form and backend logic
  forceBacklog: boolean;
  requireDueDate: boolean;
  hideDatePicker: boolean;
  hideEnergyLevel: boolean;
  showSubtaskCount: boolean;
};

const TASK_TYPE_CONFIG: Record<TaskTypeValue | "none", TaskTypeConfig> = {
  none: {
    label: "No type",
    icon: CheckSquare,
    pillClass: "bg-muted text-muted-foreground hover:bg-muted/80",
    iconClass: "text-muted-foreground",
    forceBacklog: false,
    requireDueDate: false,
    hideDatePicker: false,
    hideEnergyLevel: false,
    showSubtaskCount: false,
  },
  todo: {
    label: "Todo",
    icon: CheckSquare,
    pillClass: "bg-muted text-foreground hover:bg-muted/80",
    iconClass: "text-foreground",
    forceBacklog: false,
    requireDueDate: false,
    hideDatePicker: false,
    hideEnergyLevel: false,
    showSubtaskCount: false,
  },
  idea: {
    label: "Idea",
    icon: Lightbulb,
    pillClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25",
    iconClass: "text-amber-500",
    forceBacklog: true,
    requireDueDate: false,
    hideDatePicker: true,
    hideEnergyLevel: true,
    showSubtaskCount: false,
  },
  reminder: {
    label: "Reminder",
    icon: Bell,
    pillClass: "bg-orange-500/15 text-orange-700 dark:text-orange-400 hover:bg-orange-500/25",
    iconClass: "text-orange-500",
    forceBacklog: false,
    requireDueDate: true,
    hideDatePicker: true,
    hideEnergyLevel: true,
    showSubtaskCount: false,
  },
  project: {
    label: "Project",
    icon: Layers,
    pillClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-500/25",
    iconClass: "text-blue-500",
    forceBacklog: false,
    requireDueDate: false,
    hideDatePicker: false,
    hideEnergyLevel: false,
    showSubtaskCount: true,
  },
};

export function getTaskTypeConfig(type: TaskTypeValue | null | undefined): TaskTypeConfig {
  return TASK_TYPE_CONFIG[type ?? "none"];
}
