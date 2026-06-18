import {
  FolderKanban,
  GraduationCap,
  Inbox,
  Rocket,
  Settings,
  Star,
  type LucideIcon,
} from 'lucide-react';

export type SystemType =
  | 'academic'
  | 'project'
  | 'entrepreneurial'
  | 'personal'
  | 'custom'
  | 'inbox';

export type SystemViewType = 'timeline' | 'kanban' | 'progress' | 'list' | 'custom';

/** Módulos de tab del funnel universal (base reutilizable). */
export type SystemTabId = 'backlog' | 'planning' | 'action' | 'archive';

export const SYSTEM_TAB_LABELS: Record<SystemTabId, string> = {
  backlog: "Backlog",
  planning: "Planificación",
  action: "Acción",
  archive: "Archivo",
};

/** Etiquetas cortas para mobile: caben 4 tabs en una fila sin scroll. */
export const SYSTEM_TAB_SHORT_LABELS: Record<SystemTabId, string> = {
  backlog: "Backlog",
  planning: "Plan",
  action: "Acción",
  archive: "Archivo",
};

/** Configuración por-sistema persistida en systems.metadata (JSON). */
export interface SystemMetadata {
  /** Tabs visibles elegidos por el usuario (solo Custom). */
  tabs?: SystemTabId[];
  /** Tab que se abre por defecto (override del preset). */
  defaultTab?: SystemTabId;
}

export type SchedulingPreference = 'lowSlot' | 'peak' | 'highMedium';

export type SystemTypeConfig = {
  icon: LucideIcon;
  emoji: string;
  label: string;
  view: SystemViewType;
  extraFields: string[];
  energyDefault: 'low' | 'medium' | 'high' | 'flexible' | null;
  /** Preferred energy band for scheduling tasks from this system type. */
  schedulingPreference: SchedulingPreference;
  advisorTemplate: string;
  /** Stale advisor template: interpolates {nombre} and {n}. */
  staleTemplate: string;
  focusMinutes: number | null;
  /** Tabs del funnel universal que monta este tipo, en orden. */
  tabs: SystemTabId[];
  /** Tab abierto al entrar al sistema (el "headspace"). */
  defaultTab: SystemTabId;
};

/**
 * Columnas por defecto del board kanban del systemType `project`.
 * Reflejan el seed de `system_status_definitions` (migración 0009). La columna
 * terminal (`done`) sincroniza con el `status` de scheduling vía el puente.
 */
export const PROJECT_BOARD_COLUMNS = [
  { id: 'todo', label: 'Por hacer' },
  { id: 'in_progress', label: 'En progreso' },
  { id: 'review', label: 'En review' },
  { id: 'done', label: 'Hecho' },
] as const;

export const PROJECT_BOARD_TERMINAL = 'done';

export const SYSTEM_TYPE_CONFIG: Record<SystemType, SystemTypeConfig> = {
  academic: {
    icon: GraduationCap,
    emoji: '🎓',
    label: 'Académico',
    view: 'timeline',
    extraFields: ['course', 'professor', 'syllabus', 'collaborators'],
    energyDefault: 'medium',
    schedulingPreference: 'highMedium',
    advisorTemplate: 'Energía media — ideal para avanzar en {nombre}.',
    staleTemplate: '{n} días desde última tarea en {nombre}.',
    focusMinutes: 90,
    tabs: ['action', 'backlog', 'planning', 'archive'],
    defaultTab: 'action',
  },
  project: {
    icon: FolderKanban,
    emoji: '🗂️',
    label: 'Proyecto',
    view: 'kanban',
    extraFields: ['sprint', 'category', 'epic'],
    energyDefault: 'high',
    schedulingPreference: 'highMedium',
    advisorTemplate: '{nombre} lleva {n} días sin actividad — estás en tu ventana de alta energía.',
    staleTemplate: '{n} días desde última tarea en {nombre}.',
    focusMinutes: 25,
    tabs: ['action', 'backlog', 'planning', 'archive'],
    defaultTab: 'action',
  },
  entrepreneurial: {
    icon: Rocket,
    emoji: '🚀',
    label: 'Emprendimiento',
    view: 'progress',
    extraFields: ['milestone', 'kpi', 'hypothesis', 'learnings'],
    energyDefault: 'high',
    schedulingPreference: 'peak',
    advisorTemplate: '{nombre} espera hace {n} días. Ahora estás en pico — ¿saltás?',
    staleTemplate: '{n} días desde última tarea en {nombre}.',
    focusMinutes: 25,
    tabs: ['action', 'backlog', 'planning', 'archive'],
    defaultTab: 'action',
  },
  personal: {
    icon: Star,
    emoji: '🌟',
    label: 'Personal',
    view: 'list',
    extraFields: ['why', 'recurrence', 'reflection'],
    energyDefault: 'flexible',
    schedulingPreference: 'lowSlot',
    advisorTemplate: 'Momentos de baja energía son perfectos para {nombre}.',
    staleTemplate: '{n} días desde última tarea en {nombre}.',
    focusMinutes: null,
    tabs: ['action', 'backlog', 'planning', 'archive'],
    defaultTab: 'action',
  },
  custom: {
    icon: Settings,
    emoji: '⚙️',
    label: 'Personalizado',
    view: 'custom',
    extraFields: [],
    energyDefault: null,
    schedulingPreference: 'highMedium',
    advisorTemplate: 'Tu sistema, tus reglas.',
    staleTemplate: '{n} días desde última tarea en {nombre}.',
    focusMinutes: null,
    tabs: ['action', 'backlog', 'planning', 'archive'],
    defaultTab: 'action',
  },
  inbox: {
    icon: Inbox,
    emoji: '📥',
    label: 'Bandeja de entrada',
    view: 'list',
    extraFields: [],
    energyDefault: null,
    schedulingPreference: 'lowSlot',
    advisorTemplate: 'Tienes {n} items sin procesar.',
    staleTemplate: '{n} días desde última tarea en {nombre}.',
    focusMinutes: null,
    tabs: ['action', 'backlog', 'planning', 'archive'],
    defaultTab: 'action',
  },
};
