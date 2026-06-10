import { Bell, CalendarCheck, CheckSquare, Lightbulb, type LucideIcon } from "lucide-react";

export type TaskTypeKey = 'task' | 'idea' | 'event' | 'reminder';

export type TaskTypeConfig = {
  label: string;
  icon: LucideIcon;
  pillClass: string;
  iconClass: string;
  /** Forces this status when creating (idea → backlog) */
  defaultStatus?: string;
  forceStatus: boolean;
  /** Fields hidden in Step 2 of the creation form */
  hiddenInStep2: string[];
  /** Show overdue styling (red border/badge) */
  showOverdueStyling: boolean;
  /** Creates a taskReminder record automatically */
  createsReminder: boolean;
  /** Shorthand: hides energy + priority selectors */
  hideEnergyAndPriority: boolean;
  /** Shorthand: hides the date range picker */
  hideDates: boolean;
};

export const TASK_TYPE_CONFIG: Record<TaskTypeKey, TaskTypeConfig> = {
  task: {
    label: "Tarea",
    icon: CheckSquare,
    pillClass: "bg-muted text-foreground hover:bg-muted/80",
    iconClass: "text-foreground",
    forceStatus: false,
    hiddenInStep2: [],
    showOverdueStyling: true,
    createsReminder: false,
    hideEnergyAndPriority: false,
    hideDates: false,
  },
  idea: {
    label: "Idea",
    icon: Lightbulb,
    pillClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25",
    iconClass: "text-amber-500",
    defaultStatus: "backlog",
    forceStatus: true,
    hiddenInStep2: ['startDate', 'dueDate', 'estimatedMinutes'],
    showOverdueStyling: false,
    createsReminder: false,
    hideEnergyAndPriority: true,
    hideDates: true,
  },
  event: {
    label: "Evento",
    icon: CalendarCheck,
    pillClass: "bg-sky-500/15 text-sky-700 dark:text-sky-400 hover:bg-sky-500/25",
    iconClass: "text-sky-500",
    forceStatus: false,
    hiddenInStep2: [],
    showOverdueStyling: false,
    createsReminder: false,
    hideEnergyAndPriority: false,
    hideDates: false,
  },
  reminder: {
    label: "Recordatorio",
    icon: Bell,
    pillClass: "bg-orange-500/15 text-orange-700 dark:text-orange-400 hover:bg-orange-500/25",
    iconClass: "text-orange-500",
    forceStatus: false,
    hiddenInStep2: ['energyLevel', 'startDate'],
    showOverdueStyling: true,
    createsReminder: true,
    hideEnergyAndPriority: true,
    hideDates: false,
  },
};

/** Fallback to 'task' config for unknown/legacy types (todo, project). */
export function getTaskTypeConfig(type: string | null | undefined): TaskTypeConfig {
  return TASK_TYPE_CONFIG[type as TaskTypeKey] ?? TASK_TYPE_CONFIG.task;
}
