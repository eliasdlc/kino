import { z } from 'zod';
import { clientRequestIdField } from '@/shared/offline/client-request';
import { isValidRRule } from './recurrence';
import { parseTaskDay } from './tasks.utils';

const RECURRENCE_RULE = z
  .string()
  .max(500)
  .refine(isValidRRule, { message: 'Regla de recurrencia inválida' });

/** Único set de status válido: la máquina de estados global (scheduling). */
export const TASK_STATUSES = ['backlog', 'week', 'tomorrow', 'today', 'done'] as const;
const STATUS = z.enum(TASK_STATUSES);

// dueDate y startDate son timestamptz: aceptan "yyyy-MM-dd" o ISO datetime.
const DUE_DATE = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: 'Invalid due date',
});
const START_DATE = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: 'Invalid start date',
});

// Día de calendario LOCAL de un start/dueDate, como número comparable.
// parseTaskDay resuelve el día correcto (medianoche UTC = día pelado importado;
// resto = instante local) y aquí lo truncamos a Y/M/D para comparar solo el día.
function taskDayKey(value: string): number {
  const d = parseTaskDay(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Compara el día de calendario de due vs start (no un slice lexicográfico de la
// parte UTC del ISO): una fecha local cerca de medianoche ya no se corre de día
// al serializar a UTC y la validación no rechaza en bordes de día (FE-07).
export function dueBeforeStart(dueDate: string, startDate: string): boolean {
  return taskDayKey(dueDate) < taskDayKey(startDate);
}

export const taskMetadataSchema = z.object({
  eventSubtype: z.enum(['exam', 'quiz', 'practice']).optional(),
}).catchall(z.unknown());

export const createTaskSchema = z.object({
  systemId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: STATUS.optional(),
  energyLevel: z.enum(["high", "medium", "low"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  taskType: z.enum(["task", "idea", "event", "reminder", "epic"]).optional(),
  dueDate: DUE_DATE.optional(),
  startDate: START_DATE.optional(),
  estimatedTime: z.string().time().optional(),
  parentTaskId: z.string().uuid().optional(),
  contextTagId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
  boardStatus: z.string().max(50).optional(),
  recurrenceRule: RECURRENCE_RULE.nullable().optional(),
  metadata: taskMetadataSchema.optional(),
  clientRequestId: clientRequestIdField,
}).superRefine((data, ctx) => {
  if (data.taskType === 'event' && !data.startDate) {
    ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Events require a start date' });
  }
  if (data.taskType === 'reminder' && !data.dueDate) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Reminders require a due date' });
  }
  if (data.startDate && data.dueDate && dueBeforeStart(data.dueDate, data.startDate)) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date cannot be before start date' });
  }
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: STATUS.optional(),
  energyLevel: z.enum(["high", "medium", "low"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  taskType: z.enum(["task", "idea", "event", "reminder", "epic"]).nullable().optional(),
  dueDate: DUE_DATE.optional().nullable(),
  startDate: START_DATE.optional().nullable(),
  estimatedTime: z.string().time().optional(),
  parentTaskId: z.string().uuid().optional(),
  contextTagId: z.string().uuid().nullable().optional(),
  folderId: z.string().uuid().nullable().optional(),
  sprintId: z.string().uuid().nullable().optional(),
  systemId: z.string().uuid().optional(),
  inTodayPlan: z.boolean().optional(),
  recurrenceRule: RECURRENCE_RULE.nullable().optional(),
  metadata: taskMetadataSchema.optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.taskType === 'event' && data.startDate === null) {
    ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Events require a start date' });
  }
  if (data.taskType === 'reminder' && data.dueDate === null) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Reminders require a due date' });
  }
  if (data.startDate && data.dueDate && dueBeforeStart(data.dueDate, data.startDate)) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date cannot be before start date' });
  }
});

export const moveTaskSchema = z.object({
  status: STATUS,
});

/** Mover una tarjeta de columna del board (eje workflow, no scheduling). */
export const moveBoardSchema = z.object({
  boardStatus: z.string().min(1).max(50),
});

export const reorderTasksSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export const bulkMoveSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(50),
  status: STATUS,
});

export const bulkUpdateSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(50),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
});

export const bulkCreateTaskSchema = z.object({
  tasks: z.array(createTaskSchema).min(1).max(50),
});

export const listTasksQuerySchema = z.object({
  systemId: z.string().uuid().optional(),
  energyLevel: z.enum(["high", "medium", "low"]).optional(),
  status: STATUS.optional(),
  // Cuando es true, lista la papelera (deleted_at IS NOT NULL) en vez de activas.
  deleted: z.boolean().optional(),
});

/**
 * El mismo filtro leído de la URL, donde todo llega como string. `deleted`
 * sólo cuenta si vale exactamente "true": cualquier otro valor lista las
 * activas, que es lo que hacía la ruta cuando parseaba a mano.
 */
export const listTasksQueryParamsSchema = listTasksQuerySchema.extend({
  deleted: z
    .string()
    .optional()
    .transform((value) => (value === "true" ? true : undefined)),
});

export const createTimeLogSchema = z.object({
  systemId: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMinutes: z.number().int().min(0),
  source: z.enum(['timer', 'manual', 'pomodoro']).default('timer'),
});

export type CreateTimeLogInput = z.infer<typeof createTimeLogSchema>;
