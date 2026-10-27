import { Bell, CalendarCheck, CheckSquare, Layers, Lightbulb, GraduationCap, HelpCircle, PenTool, type LucideIcon } from "lucide-react";

export type TaskTypeKey = 'task' | 'idea' | 'event' | 'reminder' | 'epic';

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
  /** Si vencida se dice (la palabra en coral) */
  showOverdueStyling: boolean;
  /** Creates a taskReminder record automatically */
  createsReminder: boolean;
  /** Shorthand: hides energy + priority selectors */
  hideEnergyAndPriority: boolean;
  /** Shorthand: hides the date range picker */
  hideDates: boolean;
};

/**
 * Los tipos no tienen color propio: cada uno se distingue por su glifo y su
 * palabra, sobre los roles de la casa. Antes cada uno traía un tono stock de
 * Tailwind (ámbar, cielo, naranja, violeta, rojo, esmeralda) que competía con
 * el acento y con el coral de vencida.
 */
const PILL = "bg-secondary text-foreground hover:bg-secondary/80";
const ICON = "text-muted-foreground";

const TASK_TYPE_CONFIG: Record<TaskTypeKey, TaskTypeConfig> = {
  task: {
    label: "Tarea",
    icon: CheckSquare,
    pillClass: PILL,
    iconClass: ICON,
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
    pillClass: PILL,
    iconClass: ICON,
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
    pillClass: PILL,
    iconClass: ICON,
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
    pillClass: PILL,
    iconClass: ICON,
    forceStatus: false,
    hiddenInStep2: ['energyLevel', 'startDate'],
    showOverdueStyling: true,
    createsReminder: true,
    hideEnergyAndPriority: true,
    hideDates: false,
  },
  epic: {
    label: "Épica",
    icon: Layers,
    pillClass: PILL,
    iconClass: ICON,
    forceStatus: false,
    hiddenInStep2: [],
    showOverdueStyling: true,
    createsReminder: false,
    hideEnergyAndPriority: false,
    hideDates: false,
  },
};

/** Fallback to 'task' config for unknown/legacy types (todo, project). */
export function getTaskTypeConfig(
  type: string | null | undefined,
  metadata?: Record<string, unknown> | null
): TaskTypeConfig {
  const baseConfig = TASK_TYPE_CONFIG[type as TaskTypeKey] ?? TASK_TYPE_CONFIG.task;

  if (type === 'event' && metadata?.eventSubtype) {
    const subtype = metadata.eventSubtype as string;
    if (subtype === 'exam') {
      return {
        ...baseConfig,
        label: "Examen",
        icon: GraduationCap,
        pillClass: PILL,
        iconClass: ICON,
      };
    }
    if (subtype === 'quiz') {
      return {
        ...baseConfig,
        label: "Quiz",
        icon: HelpCircle,
        pillClass: PILL,
        iconClass: ICON,
      };
    }
    if (subtype === 'practice') {
      return {
        ...baseConfig,
        label: "Práctica",
        icon: PenTool,
        pillClass: PILL,
        iconClass: ICON,
      };
    }
  }

  return baseConfig;
}
