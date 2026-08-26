import { parseDueDate } from "./tasks.utils";
import type { TaskTransport, UpdateTaskInput } from "./tasks.types";
import type { TaskTypeValue } from "@/shared/types/enums";

/**
 * Lógica pura del detalle de tarea (KIN-146 · FE-05).
 *
 * Extraído de `TaskDetailSheet` sin cambiar comportamiento. Lo que más importa
 * aquí es `buildDirtyTaskData`: decide qué campos viajan al servidor en cada
 * autosave y vivía dentro del componente, así que no había forma de probar sus
 * reglas — y son reglas con historia (ver los comentarios).
 */

export const PRIORITY_LABELS: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const ENERGY_LABELS: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** true si dueDate tiene hora significativa (no medianoche local). */
export function hasDueTime(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

/** Cambia el día conservando la hora previa (Calendar devuelve medianoche). */
export function withDay(prev: Date | undefined, day: Date | undefined): Date | undefined {
  if (!day) return undefined;
  const next = new Date(day);
  if (prev) next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
  return next;
}

/** Aplica una hora "HH:mm" al Date actual. */
export function withTime(prev: Date | undefined, value: string): Date | undefined {
  if (!prev || !value) return prev;
  const [h, m] = value.split(":").map(Number);
  const next = new Date(prev);
  next.setHours(h ?? 0, m ?? 0, 0, 0);
  return next;
}

/** El estado editable del formulario de detalle. */
export interface TaskDetailFormState {
  title: string;
  description: string;
  priority: TaskTransport["priority"];
  energyLevel: TaskTransport["energyLevel"];
  taskType: TaskTypeValue | undefined;
  dueDate: Date | undefined;
  startDate: Date | undefined;
  selectedFolderId: string;
  sprintId: string;
  contextTagId: string | null;
  recurrenceRule: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Solo los campos que cambiaron respecto al `task` original. Un único builder
 * usado por autosave y "Guardar y cerrar":
 *  - dueDate siempre como ISO (conserva hora; antes el botón truncaba a día).
 *  - limpiar una fecha existente manda `null` (antes omitía → DB nunca limpiaba).
 *  - no incluir dueDate cuando no cambió evita el reset de recordatorios/flags
 *    en cada tecla.
 */
export function buildDirtyTaskData(task: TaskTransport, form: TaskDetailFormState): UpdateTaskInput {
  const data: UpdateTaskInput = {};

  const trimmedTitle = form.title.trim();
  if (trimmedTitle !== task.title) data.title = trimmedTitle;
  if (form.description !== (task.description ?? "")) data.description = form.description || undefined;
  if (form.priority !== task.priority) data.priority = form.priority;
  if (form.energyLevel !== task.energyLevel) data.energyLevel = form.energyLevel;

  const curType = form.taskType ?? null;
  if (curType !== (task.taskType ?? null)) data.taskType = curType;

  const curDue = form.dueDate ? form.dueDate.toISOString() : null;
  const origDue = task.dueDate ? parseDueDate(task.dueDate).toISOString() : null;
  if (curDue !== origDue) data.dueDate = curDue;

  // startDate como ISO (conserva hora), igual que dueDate.
  const curStart = form.startDate ? form.startDate.toISOString() : null;
  const origStart = task.startDate ? parseDueDate(task.startDate).toISOString() : null;
  if (curStart !== origStart) data.startDate = curStart;

  const curFolder = form.selectedFolderId !== "none" ? form.selectedFolderId : null;
  if (curFolder !== (task.folderId ?? null)) data.folderId = curFolder;

  const curSprint = form.sprintId !== "none" ? form.sprintId : null;
  if (curSprint !== (task.sprintId ?? null)) data.sprintId = curSprint;

  if (form.contextTagId !== (task.contextTagId ?? null)) data.contextTagId = form.contextTagId;

  if (form.recurrenceRule !== (task.recurrenceRule ?? null)) data.recurrenceRule = form.recurrenceRule;

  const curMetadataStr = form.metadata ? JSON.stringify(form.metadata) : null;
  const origMetadataStr = task.metadata ? JSON.stringify(task.metadata) : null;
  if (curMetadataStr !== origMetadataStr) data.metadata = form.metadata;

  return data;
}

/** Los tipos de evento académico que piden calificación al completarse. */
const GRADED_EVENT_SUBTYPES = ["exam", "quiz", "practice"];

export function needsGradeField(
  isDone: boolean,
  taskType: TaskTypeValue | undefined,
  metadata: Record<string, unknown> | null,
): boolean {
  return (
    isDone &&
    taskType === "event" &&
    GRADED_EVENT_SUBTYPES.includes(metadata?.eventSubtype as string)
  );
}

/** Nombre de archivo del export JSON de una tarea. */
export function taskJsonFilename(title: string | null | undefined): string {
  return `${(title ?? "tarea").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
}
