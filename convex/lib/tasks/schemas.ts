import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { isValidRRule } from '../../../src/features/tasks/recurrence';
import { calendarDayInTz } from '../time';

// Los schemas del contrato de tareas, con ids de Convex. Son los mismos que
// validaba la API REST; las fechas siguen entrando como texto ISO, que es lo
// que el navegador manda, y las funciones las convierten a milisegundos.

export const TASK_STATUSES = ['backlog', 'week', 'tomorrow', 'today', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
const STATUS = z.enum(TASK_STATUSES);
const ENERGY = z.enum(['high', 'medium', 'low']);
const PRIORITY = z.enum(['critical', 'high', 'medium', 'low']);
const TASK_TYPE = z.enum(['task', 'idea', 'event', 'reminder', 'epic']);

const ISO_DATE = z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' });
const RECURRENCE_RULE = z
  .string()
  .max(500)
  .refine(isValidRRule, { message: 'Regla de recurrencia inválida' });
/** 'HH:MM' o 'HH:MM:SS'. */
const CLOCK = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time');

/** Día calendario de un instante, en UTC: sólo para comparar inicio y vencimiento. */
function dayKey(iso: string): string {
  return calendarDayInTz(Date.parse(iso), 'UTC');
}
export function dueBeforeStart(dueDate: string, startDate: string): boolean {
  return dayKey(dueDate) < dayKey(startDate);
}

export const taskMetadataSchema = z
  .object({ eventSubtype: z.enum(['exam', 'quiz', 'practice']).optional() })
  .catchall(z.unknown());

export const createTaskSchema = z
  .object({
    systemId: zid('systems'),
    title: z.string().min(1).max(500),
    description: z.string().optional(),
    status: STATUS.optional(),
    energyLevel: ENERGY.optional(),
    priority: PRIORITY.optional(),
    taskType: TASK_TYPE.optional(),
    dueDate: ISO_DATE.optional(),
    startDate: ISO_DATE.optional(),
    estimatedTime: CLOCK.optional(),
    parentTaskId: zid('tasks').optional(),
    contextTagId: zid('contextTags').optional(),
    folderId: zid('folders').optional(),
    sprintId: zid('sprints').optional(),
    boardStatus: z.string().max(50).optional(),
    recurrenceRule: RECURRENCE_RULE.nullable().optional(),
    metadata: taskMetadataSchema.optional(),
    clientRequestId: z.string().min(1).max(64).optional(),
  })
  .superRefine((data, ctx) => {
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

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().optional(),
    status: STATUS.optional(),
    energyLevel: ENERGY.optional(),
    priority: PRIORITY.optional(),
    taskType: TASK_TYPE.nullable().optional(),
    dueDate: ISO_DATE.nullable().optional(),
    startDate: ISO_DATE.nullable().optional(),
    estimatedTime: CLOCK.optional(),
    parentTaskId: zid('tasks').optional(),
    contextTagId: zid('contextTags').nullable().optional(),
    folderId: zid('folders').nullable().optional(),
    sprintId: zid('sprints').nullable().optional(),
    systemId: zid('systems').optional(),
    inTodayPlan: z.boolean().optional(),
    recurrenceRule: RECURRENCE_RULE.nullable().optional(),
    metadata: taskMetadataSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
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

export const listTasksSchema = z.object({
  systemId: zid('systems').optional(),
  energyLevel: ENERGY.optional(),
  status: STATUS.optional(),
  /** Con `true` lista la papelera en vez de las activas. */
  deleted: z.boolean().optional(),
});

export const createTimeLogSchema = z.object({
  id: zid('tasks'),
  systemId: zid('systems'),
  startedAt: ISO_DATE,
  endedAt: ISO_DATE,
  durationMinutes: z.number().int().min(0),
  source: z.enum(['timer', 'manual', 'pomodoro']).default('timer'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
