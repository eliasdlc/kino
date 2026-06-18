import type { SystemType } from "@/shared/lib/system-types";
import type { TaskTypeConfig } from "./task-type-config";

/** Campos reordenables/ocultables del paso de planificación del CreateTaskDialog. */
export type TaskDialogFieldKey =
  | 'priority'
  | 'energyLevel'
  | 'dates'
  | 'estimatedMinutes'
  | 'folder'
  | 'tag'
  | 'sprint';

/** Orden por defecto (inbox/custom/fallback): refleja el wizard histórico. */
const DEFAULT_FIELD_ORDER: TaskDialogFieldKey[] = [
  'priority', 'energyLevel', 'dates', 'estimatedMinutes', 'folder', 'tag',
];

/**
 * Qué campos muestra el paso de planificación por systemType y en qué orden.
 * Un campo ausente de la lista queda oculto para ese tipo (ej: academic sin
 * `sprint`); el orden prioriza lo que cada sistema necesita primero. Única
 * fuente de verdad: para darle un layout propio a un tipo, editá su lista acá.
 * Los tipos sin entrada caen a `DEFAULT_FIELD_ORDER`.
 */
export const TASK_DIALOG_FIELDS: Partial<Record<SystemType, TaskDialogFieldKey[]>> = {
  // Académico prioriza cuándo entrega y cuánto le toma; nunca usa sprints.
  academic: ['dates', 'estimatedMinutes', 'priority', 'energyLevel', 'tag', 'folder'],
  // Proyecto arranca por sprint y prioridad (board kanban).
  project: ['sprint', 'priority', 'dates', 'energyLevel', 'estimatedMinutes', 'tag', 'folder'],
  // Emprendimiento empuja por energía/prioridad antes que fechas.
  entrepreneurial: ['priority', 'energyLevel', 'dates', 'estimatedMinutes', 'tag', 'folder'],
  // Personal se ancla a la energía disponible; sin sprints.
  personal: ['energyLevel', 'dates', 'priority', 'tag', 'folder', 'estimatedMinutes'],
};

export function getTaskDialogFields(
  systemType: SystemType | null | undefined,
): TaskDialogFieldKey[] {
  return (systemType && TASK_DIALOG_FIELDS[systemType]) ?? DEFAULT_FIELD_ORDER;
}

/**
 * Oculta campos según el tipo de tarea seleccionado (idea/reminder/...), se
 * compone sobre la visibilidad por systemType. Conserva el comportamiento
 * histórico de `task-type-config.ts`.
 */
export function isFieldHiddenByTaskType(
  field: TaskDialogFieldKey,
  type: TaskTypeConfig,
): boolean {
  switch (field) {
    case 'priority':
      return type.hideEnergyAndPriority;
    case 'energyLevel':
      return type.hideEnergyAndPriority || type.hiddenInStep2.includes('energyLevel');
    case 'dates':
      return type.hideDates;
    case 'estimatedMinutes':
      return type.hiddenInStep2.includes('estimatedMinutes');
    default:
      return false;
  }
}
