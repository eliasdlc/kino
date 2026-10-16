import { z } from 'zod';
import { clientRequestIdField } from '@/shared/offline/client-request';
import { isValidRRule } from './recurrence';
import { parseTaskDay } from './tasks.utils';

const RECURRENCE_RULE = z
  .string()
  .max(500)
  .refine(isValidRRule, { message: 'Regla de recurrencia inválida' });

/** Único set de status válido: la máquina de estados global (scheduling). */
const TASK_STATUSES = ['backlog', 'week', 'tomorrow', 'today', 'done'] as const;
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

const taskMetadataSchema = z.object({
  eventSubtype: z.enum(['exam', 'quiz', 'practice']).optional(),
}).catchall(z.unknown());

export const createTaskSchema = z.object({
  systemId: z.string(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: STATUS.optional(),
  energyLevel: z.enum(["high", "medium", "low"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  taskType: z.enum(["task", "idea", "event", "reminder", "epic"]).optional(),
  dueDate: DUE_DATE.optional(),
  startDate: START_DATE.optional(),
  estimatedTime: z.string().time().optional(),
  parentTaskId: z.string().optional(),
  contextTagId: z.string().optional(),
  folderId: z.string().optional(),
  sprintId: z.string().optional(),
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
