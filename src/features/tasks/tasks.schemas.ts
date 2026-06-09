import { z } from 'zod';

const STATUS = z.string().min(1).max(50);

export const createTaskSchema = z.object({
  systemId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: STATUS.optional(),
  energyLevel: z.enum(["high", "medium", "low"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  taskType: z.enum(["task", "idea", "event", "reminder", "habit"]).optional(),
  dueDate: z.string().date().optional(),
  startDate: z.string().date().optional(),
  estimatedTime: z.string().time().optional(),
  parentTaskId: z.string().uuid().optional(),
  contextTagId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).superRefine((data, ctx) => {
  if (data.taskType === 'event' && !data.startDate) {
    ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Events require a start date' });
  }
  if (data.taskType === 'reminder' && !data.dueDate) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Reminders require a due date' });
  }
  if (data.startDate && data.dueDate && data.dueDate < data.startDate) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date cannot be before start date' });
  }
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: STATUS.optional(),
  energyLevel: z.enum(["high", "medium", "low"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  taskType: z.enum(["task", "idea", "event", "reminder", "habit"]).nullable().optional(),
  dueDate: z.string().date().optional().nullable(),
  startDate: z.string().date().optional().nullable(),
  estimatedTime: z.string().time().optional(),
  parentTaskId: z.string().uuid().optional(),
  contextTagId: z.string().uuid().optional(),
  folderId: z.string().uuid().nullable().optional(),
  systemId: z.string().uuid().optional(),
  inTodayPlan: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.taskType === 'event' && data.startDate === null) {
    ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Events require a start date' });
  }
  if (data.taskType === 'reminder' && data.dueDate === null) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Reminders require a due date' });
  }
  if (data.startDate && data.dueDate && data.dueDate < data.startDate) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date cannot be before start date' });
  }
});

export const moveTaskSchema = z.object({
  status: STATUS,
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
});

export const createTimeLogSchema = z.object({
  systemId: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMinutes: z.number().int().min(0),
  source: z.enum(['timer', 'manual', 'pomodoro']).default('timer'),
});

export type CreateTimeLogInput = z.infer<typeof createTimeLogSchema>;
