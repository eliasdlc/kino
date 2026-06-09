import {
  Briefcase,
  GraduationCap,
  Inbox,
  Rocket,
  Settings,
  Star,
  type LucideIcon,
} from 'lucide-react';

export type SystemType =
  | 'academic'
  | 'professional'
  | 'entrepreneurial'
  | 'personal'
  | 'custom'
  | 'inbox';

export type SystemViewType = 'timeline' | 'kanban' | 'progress' | 'list' | 'custom';

export type SystemStatusDef = {
  name: string;
  label: string;
  position: number;
  emoji?: string;
};

export type SystemTypeConfig = {
  icon: LucideIcon;
  emoji: string;
  label: string;
  view: SystemViewType;
  statuses: SystemStatusDef[];
  extraFields: string[];
  energyDefault: 'low' | 'medium' | 'high' | 'flexible' | null;
  advisorTemplate: string;
  focusMinutes: number | null;
};

export const SYSTEM_TYPE_CONFIG: Record<SystemType, SystemTypeConfig> = {
  academic: {
    icon: GraduationCap,
    emoji: '🎓',
    label: 'Académico',
    view: 'timeline',
    statuses: [
      { name: 'idea', label: 'Idea', position: 0, emoji: '💡' },
      { name: 'studying', label: 'Estudiando', position: 1, emoji: '📖' },
      { name: 'draft', label: 'Borrador', position: 2, emoji: '✏️' },
      { name: 'submitted', label: 'Entregado', position: 3, emoji: '📤' },
      { name: 'feedback', label: 'Feedback', position: 4, emoji: '💬' },
      { name: 'done', label: 'Listo', position: 5, emoji: '✅' },
    ],
    extraFields: ['course', 'professor', 'syllabus', 'collaborators'],
    energyDefault: 'medium',
    advisorTemplate: 'Próxima entrega en {days} días — ¿cuándo empiezas?',
    focusMinutes: 90,
  },
  professional: {
    icon: Briefcase,
    emoji: '💼',
    label: 'Profesional',
    view: 'kanban',
    statuses: [
      { name: 'backlog', label: 'Backlog', position: 0 },
      { name: 'planned', label: 'Planificado', position: 1 },
      { name: 'in-progress', label: 'En progreso', position: 2 },
      { name: 'blocked', label: 'Bloqueado', position: 3, emoji: '🚫' },
      { name: 'review', label: 'Revisión', position: 4 },
      { name: 'done', label: 'Listo', position: 5, emoji: '✅' },
    ],
    extraFields: ['project', 'assignee', 'dependencies', 'reviewer'],
    energyDefault: 'high',
    advisorTemplate: '{n} tareas bloqueando a otros — crítico hoy.',
    focusMinutes: 25,
  },
  entrepreneurial: {
    icon: Rocket,
    emoji: '🚀',
    label: 'Emprendimiento',
    view: 'progress',
    statuses: [
      { name: 'idea', label: 'Idea', position: 0, emoji: '💡' },
      { name: 'validating', label: 'Validando', position: 1 },
      { name: 'building', label: 'Construyendo', position: 2 },
      { name: 'launched', label: 'Lanzado', position: 3, emoji: '🚀' },
      { name: 'scaling', label: 'Escalando', position: 4 },
      { name: 'done', label: 'Listo', position: 5, emoji: '✅' },
    ],
    extraFields: ['milestone', 'kpi', 'hypothesis', 'learnings'],
    energyDefault: 'high',
    advisorTemplate: 'Velocidad esta semana: {n} — {comparison} que semana anterior.',
    focusMinutes: 25,
  },
  personal: {
    icon: Star,
    emoji: '🌟',
    label: 'Personal',
    view: 'list',
    statuses: [
      { name: 'idea', label: 'Idea', position: 0, emoji: '💡' },
      { name: 'planning', label: 'Planificando', position: 1 },
      { name: 'active', label: 'Activo', position: 2 },
      { name: 'paused', label: 'Pausado', position: 3 },
      { name: 'completed', label: 'Completado', position: 4, emoji: '✅' },
    ],
    extraFields: ['why', 'recurrence', 'reflection'],
    energyDefault: 'flexible',
    advisorTemplate: 'Buen ritmo — {n} tareas esta semana.',
    focusMinutes: null,
  },
  custom: {
    icon: Settings,
    emoji: '⚙️',
    label: 'Personalizado',
    view: 'custom',
    statuses: [],
    extraFields: [],
    energyDefault: null,
    advisorTemplate: 'Tu sistema, tus reglas.',
    focusMinutes: null,
  },
  inbox: {
    icon: Inbox,
    emoji: '📥',
    label: 'Bandeja de entrada',
    view: 'list',
    statuses: [
      { name: 'new', label: 'Nuevo', position: 0 },
      { name: 'triaged', label: 'Clasificado', position: 1 },
      { name: 'processed', label: 'Procesado', position: 2 },
    ],
    extraFields: [],
    energyDefault: null,
    advisorTemplate: 'Tienes {n} items sin procesar.',
    focusMinutes: null,
  },
};
