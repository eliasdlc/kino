import { z } from "zod";
import type { CreateTaskInput } from "./tasks.types";
import { dayToLocalISO } from "./tasks.utils";
import { minutesToTimeString } from "./EstimatedTimePicker";
import type { ParsedQuickInput } from "./quick-date-parse";

/**
 * Schema y lógica pura del diálogo de crear tarea (KIN-146 · FE-05).
 *
 * Extraído de `CreateTaskDialog` sin cambiar comportamiento. Lo que gana más
 * con la salida es `buildStudyPlanTasks`: el plan de repaso de un examen se
 * calcula con aritmética de días y no había forma de probarlo.
 */

export const formSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(500),
  taskType: z.enum(['task', 'idea', 'event', 'reminder', 'epic']).nullable().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  energyLevel: z.enum(['high', 'medium', 'low']),
  startDate: z.string().date().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  startTime: z.string().optional(),
  dueTime: z.string().optional(),
  estimatedMinutes: z.number().int().min(1).nullable().optional(),
  description: z.string().optional(),
  folderId: z.string().uuid().nullable().optional(),
  contextTagId: z.string().uuid().nullable().optional(),
  sprintId: z.string().uuid().nullable().optional(),
  recurrenceRule: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

/** Qué campos valida cada paso antes de dejar avanzar. */
export const STEP_FIELDS: Record<1 | 2 | 3, (keyof FormValues)[]> = {
  1: ['title'],
  2: ['priority', 'energyLevel'],
  3: [],
};

export const PRIORITY_LABELS: Record<string, string> = {
  critical: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

/** Qué chips del parser en lenguaje natural se muestran, según lo descartado. */
export function nlChipVisibility(
  parsed: ParsedQuickInput | null | undefined,
  ignored: Set<string>,
) {
  const date = !!(parsed?.dueDate && !ignored.has('dueDate'));
  const priority = !!(parsed?.priority && !ignored.has('priority'));
  const system = !!(parsed?.systemHint && !ignored.has('systemHint'));
  const tag = !!(parsed?.tagHint && !ignored.has('tagHint'));
  const duration = !!(parsed?.estimatedMinutes && !ignored.has('estimatedMinutes'));
  return { date, priority, system, tag, duration, any: date || priority || system || tag || duration };
}

/**
 * Arma el payload de creación desde los valores del formulario. Las fechas
 * salen como ISO en hora local (medianoche si no se eligió hora), y los campos
 * vacíos se omiten en vez de mandarse nulos.
 */
export function buildCreateTaskPayload(
  values: FormValues,
  opts: { systemId: string; parentTaskId?: string; hideEnergyAndPriority: boolean },
): CreateTaskInput {
  return {
    systemId: opts.systemId,
    title: values.title.trim(),
    priority: values.priority,
    energyLevel: opts.hideEnergyAndPriority ? undefined : values.energyLevel,
    ...(values.taskType ? { taskType: values.taskType } : {}),
    // startDate/dueDate como ISO en hora local (medianoche si no hay hora).
    ...(values.startDate ? { startDate: dayToLocalISO(values.startDate, values.startTime) } : {}),
    ...(values.dueDate ? { dueDate: dayToLocalISO(values.dueDate, values.dueTime) } : {}),
    ...(values.estimatedMinutes ? { estimatedTime: minutesToTimeString(values.estimatedMinutes) } : {}),
    ...(values.description ? { description: values.description } : {}),
    ...(values.folderId ? { folderId: values.folderId } : {}),
    ...(values.contextTagId ? { contextTagId: values.contextTagId } : {}),
    ...(values.sprintId ? { sprintId: values.sprintId } : {}),
    ...(values.recurrenceRule ? { recurrenceRule: values.recurrenceRule } : {}),
    ...(values.metadata ? { metadata: values.metadata } : {}),
    ...(opts.parentTaskId ? { parentTaskId: opts.parentTaskId } : {}),
  } as CreateTaskInput;
}

/** Días antes del examen en que cae cada repaso. */
const STUDY_PLAN_OFFSETS: { days: number; prefix: string }[] = [
  { days: 5, prefix: 'Repaso 1' },
  { days: 2, prefix: 'Repaso Final' },
];

/**
 * Tareas de repaso previas a un examen o quiz, cuando el usuario pidió el plan
 * de estudio. Devuelve lista vacía si no aplica: no es un evento evaluable, no
 * se activó el switch, o no hay fecha de inicio sobre la que contar hacia atrás.
 */
export function buildStudyPlanTasks(
  payload: CreateTaskInput,
  parentId: string,
  systemId: string,
): CreateTaskInput[] {
  const meta = payload.metadata as Record<string, unknown> | undefined;
  const isExamOrQuiz = meta?.eventSubtype === 'exam' || meta?.eventSubtype === 'quiz';
  if (!isExamOrQuiz || !meta?.generateStudyPlan || !payload.startDate) return [];

  const start = new Date(payload.startDate);

  return STUDY_PLAN_OFFSETS.map(({ days, prefix }) => {
    const date = new Date(start);
    date.setDate(date.getDate() - days);
    return {
      systemId,
      title: `${prefix}: ${payload.title}`,
      status: 'backlog' as const,
      priority: 'high' as const,
      energyLevel: 'high' as const,
      taskType: 'task' as const,
      startDate: date.toISOString(),
      dueDate: date.toISOString(),
      parentTaskId: parentId,
    } as CreateTaskInput;
  });
}
