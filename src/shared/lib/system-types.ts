import {
  AlarmClock,
  BookMarked,
  BookOpen,
  CalendarDays,
  Feather,
  FileText,
  FlaskConical,
  Folder,
  FolderKanban,
  GraduationCap,
  Hammer,
  Inbox,
  Layers,
  Lightbulb,
  ListChecks,
  ListTree,
  PencilLine,
  Repeat,
  Rocket,
  Send,
  Settings,
  Star,
  Target,
  type LucideIcon,
} from 'lucide-react';

export type SystemType =
  | 'academic'
  | 'project'
  | 'entrepreneurial'
  | 'personal'
  | 'custom'
  | 'inbox'
  | 'writing';

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

/**
 * Campo declarado por el arquetipo, persistido en la columna `metadata` (jsonb)
 * de folders (rol de carpeta) o tasks (task kind). El server valida contra el
 * Zod derivado de estas declaraciones — nada entra a metadata sin schema.
 */
export interface ArchetypeFieldDef {
  id: string;
  label: string;
  input: 'text' | 'date' | 'number';
}

/**
 * Qué son las carpetas dentro de un arquetipo ("clase", "milestone", "obra").
 * null → el arquetipo no ofrece carpetas (project agrupa por sprint/epic;
 * inbox es un funnel plano de triage).
 */
export interface FolderRole {
  noun: string;
  nounPlural: string;
  /** CTA de creación, p.ej. "Nueva clase". */
  newLabel: string;
  placeholder: string;
  icon: LucideIcon;
  /** Campos propios del rol, persistidos en folders.metadata. */
  fields: ArchetypeFieldDef[];
}

/** Qué son las pages dentro de un arquetipo ("apuntes", "manuscritos"…). */
export interface PageRole {
  noun: string;
  nounPlural: string;
  /** true → el sistema abre en la biblioteca de pages, no en tasks (writing). */
  primary: boolean;
}

/**
 * Qué "es" una tarea dentro de un arquetipo (entrega, examen, experimento…).
 * Se persiste en tasks.metadata.kind + fields; capa semántica encima del
 * taskType global (task/idea/event/reminder/epic), que no cambia.
 */
export interface TaskKindDef {
  id: string;
  label: string;
  icon: LucideIcon;
  fields: ArchetypeFieldDef[];
}

/**
 * Manifiesto de arquetipo: la única fuente de verdad de cómo se comporta un
 * systemType — vocabulario, rol de folders/pages, kinds de tarea, preset de
 * vista y defaults de energía. Los componentes compartidos leen esto en vez de
 * hardcodear por tipo; añadir un arquetipo = escribir un manifiesto.
 * Ver docs/DISENO-ARQUETIPOS-2026-07.md (D9-D13).
 */
export type ArchetypeManifest = {
  icon: LucideIcon;
  label: string;
  view: SystemViewType;
  folderRole: FolderRole | null;
  pageRole: PageRole;
  taskKinds: TaskKindDef[];
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

/** Busca la definición de un task kind en el manifiesto del arquetipo. */
export function getTaskKind(systemType: SystemType, kindId: unknown): TaskKindDef | null {
  if (typeof kindId !== 'string') return null;
  return SYSTEM_TYPE_CONFIG[systemType]?.taskKinds.find((k) => k.id === kindId) ?? null;
}

const UNIVERSAL_TABS: SystemTabId[] = ['action', 'backlog', 'planning', 'archive'];

export const SYSTEM_TYPE_CONFIG: Record<SystemType, ArchetypeManifest> = {
  academic: {
    icon: GraduationCap,
    label: 'Académico',
    view: 'timeline',
    folderRole: {
      noun: 'clase',
      nounPlural: 'clases',
      newLabel: 'Nueva clase',
      placeholder: 'Nombre de la clase',
      icon: BookOpen,
      fields: [
        { id: 'professor', label: 'Profesor/a', input: 'text' },
        { id: 'schedule', label: 'Horario', input: 'text' },
        { id: 'semester', label: 'Semestre', input: 'text' },
      ],
    },
    pageRole: { noun: 'apunte', nounPlural: 'apuntes', primary: false },
    taskKinds: [
      { id: 'assignment', label: 'Entrega', icon: FileText, fields: [] },
      { id: 'exam', label: 'Examen', icon: AlarmClock, fields: [] },
      { id: 'reading', label: 'Lectura', icon: BookOpen, fields: [] },
      { id: 'practice', label: 'Práctica', icon: PencilLine, fields: [] },
    ],
    energyDefault: 'medium',
    schedulingPreference: 'highMedium',
    advisorTemplate: 'Energía media — ideal para avanzar en {nombre}.',
    staleTemplate: '{n} días desde última tarea en {nombre}.',
    focusMinutes: 90,
    tabs: UNIVERSAL_TABS,
    defaultTab: 'action',
  },
  project: {
    icon: FolderKanban,
    label: 'Proyecto',
    view: 'kanban',
    // Sprints + epics + categorías ya agrupan; carpetas aquí duplicarían grouping.
    folderRole: null,
    pageRole: { noun: 'doc', nounPlural: 'docs', primary: false },
    taskKinds: [],
    energyDefault: 'high',
    schedulingPreference: 'highMedium',
    advisorTemplate: '{nombre} lleva {n} días sin actividad — estás en tu ventana de alta energía.',
    staleTemplate: '{n} días desde última tarea en {nombre}.',
    focusMinutes: 25,
    tabs: UNIVERSAL_TABS,
    defaultTab: 'action',
  },
  entrepreneurial: {
    icon: Rocket,
    label: 'Emprendimiento',
    view: 'progress',
    folderRole: {
      noun: 'milestone',
      nounPlural: 'milestones',
      newLabel: 'Nuevo milestone',
      placeholder: 'Nombre del milestone',
      icon: Target,
      fields: [{ id: 'targetDate', label: 'Fecha objetivo', input: 'date' }],
    },
    pageRole: { noun: 'learning', nounPlural: 'learnings', primary: false },
    taskKinds: [
      {
        id: 'experiment',
        label: 'Experimento',
        icon: FlaskConical,
        fields: [{ id: 'hypothesis', label: 'Hipótesis (1 línea)', input: 'text' }],
      },
      { id: 'build', label: 'Build', icon: Hammer, fields: [] },
      { id: 'learning', label: 'Learning', icon: Lightbulb, fields: [] },
    ],
    energyDefault: 'high',
    schedulingPreference: 'peak',
    advisorTemplate: '{nombre} espera hace {n} días. Ahora estás en pico — ¿saltás?',
    staleTemplate: '{n} días desde última tarea en {nombre}.',
    focusMinutes: 25,
    tabs: UNIVERSAL_TABS,
    defaultTab: 'action',
  },
  personal: {
    icon: Star,
    label: 'Personal',
    view: 'list',
    folderRole: {
      noun: 'área',
      nounPlural: 'áreas',
      newLabel: 'Nueva área',
      placeholder: 'Nombre del área',
      icon: Layers,
      fields: [],
    },
    pageRole: { noun: 'nota', nounPlural: 'notas', primary: false },
    taskKinds: [
      { id: 'habit', label: 'Hábito', icon: Repeat, fields: [] },
      { id: 'errand', label: 'Recado', icon: ListChecks, fields: [] },
      { id: 'event', label: 'Evento', icon: CalendarDays, fields: [] },
    ],
    energyDefault: 'flexible',
    schedulingPreference: 'lowSlot',
    advisorTemplate: 'Momentos de baja energía son perfectos para {nombre}.',
    staleTemplate: '{n} días desde última tarea en {nombre}.',
    focusMinutes: null,
    tabs: UNIVERSAL_TABS,
    defaultTab: 'action',
  },
  custom: {
    icon: Settings,
    label: 'Personalizado',
    view: 'custom',
    folderRole: {
      noun: 'carpeta',
      nounPlural: 'carpetas',
      newLabel: 'Nueva carpeta',
      placeholder: 'Nombre de la carpeta',
      icon: Folder,
      fields: [],
    },
    pageRole: { noun: 'página', nounPlural: 'páginas', primary: false },
    taskKinds: [],
    energyDefault: null,
    schedulingPreference: 'highMedium',
    advisorTemplate: 'Tu sistema, tus reglas.',
    staleTemplate: '{n} días desde última tarea en {nombre}.',
    focusMinutes: null,
    tabs: UNIVERSAL_TABS,
    defaultTab: 'action',
  },
  writing: {
    icon: Feather,
    label: 'Escritura',
    view: 'list',
    // Obras: libro/blog/cómic/serie con meta de palabras. El progreso de palabras
    // se deriva del contenido Tiptap de las pages — nunca un contador persistido.
    folderRole: {
      noun: 'obra',
      nounPlural: 'obras',
      newLabel: 'Nueva obra',
      placeholder: 'Título de la obra',
      icon: BookMarked,
      // `medium` declara la forma de la obra (novela, manga, cómic, guion, serial…)
      // y en W3 gobernará la estructura del editor por MediumManifest (PLAN-11 §6).
      // Hasta entonces es texto libre; W3 lo convierte en selección tipada.
      fields: [
        { id: 'medium', label: 'Medium (novela, manga, cómic, guion, serial)', input: 'text' },
        { id: 'wordGoal', label: 'Meta de palabras', input: 'number' },
        { id: 'targetDate', label: 'Fecha objetivo', input: 'date' },
      ],
    },
    // pages-first: el sistema abre en la biblioteca de manuscritos, no en tareas.
    pageRole: { noun: 'manuscrito', nounPlural: 'manuscritos', primary: true },
    taskKinds: [
      { id: 'write', label: 'Escribir', icon: PencilLine, fields: [] },
      { id: 'revise', label: 'Revisar', icon: Feather, fields: [] },
      { id: 'outline', label: 'Outline', icon: ListTree, fields: [] },
      { id: 'publish', label: 'Publicar', icon: Send, fields: [] },
    ],
    energyDefault: 'high',
    // El diferenciador: escribir en tu mejor ventana creativa (pico de energía).
    schedulingPreference: 'peak',
    advisorTemplate: 'Tu mejor ventana creativa es ahora — dale a {nombre}.',
    staleTemplate: '{nombre} lleva {n} días sin una sesión de escritura.',
    focusMinutes: 45,
    tabs: UNIVERSAL_TABS,
    defaultTab: 'action',
  },
  inbox: {
    icon: Inbox,
    label: 'Bandeja de entrada',
    view: 'list',
    // El inbox es un funnel de triage, no un archivo: sin carpetas a propósito.
    folderRole: null,
    pageRole: { noun: 'nota', nounPlural: 'notas', primary: false },
    taskKinds: [],
    energyDefault: null,
    schedulingPreference: 'lowSlot',
    advisorTemplate: 'Tienes {n} items sin procesar.',
    staleTemplate: '{n} días desde última tarea en {nombre}.',
    focusMinutes: null,
    tabs: UNIVERSAL_TABS,
    defaultTab: 'action',
  },
};
