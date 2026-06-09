import { z } from 'zod';

export const createTaskSchema = z.object({
  systemId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["backlog", "week", "tomorrow", "today", "done", "archived"]).optional(),
  energyLevel: z.enum(["high", "medium", "low"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  taskType: z.enum(["task", "idea", "event", "reminder", "habit"]).optional(),
  dueDate: z.string().date().optional(),
  startDate: z.string().date().optional(),
  estimatedTime: z.string().time().optional(),
  parentTaskId: z.string().uuid().optional(),
  contextTagId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .omit({ systemId: true })
  .extend({
    // Allow null to explicitly clear date (e.g., moving to "unscheduled" via DnD)
    startDate: z.string().date().nullable().optional(),
    // Allow null to explicitly clear folder assignment (e.g., on system change)
    folderId: z.string().uuid().nullable().optional(),
    // Allow null to explicitly clear task type
    taskType: z.enum(["task", "idea", "event", "reminder", "habit"]).nullable().optional(),
    // Allow system changes (validated in service layer for folder consistency)
    systemId: z.string().uuid().optional(),
    inTodayPlan: z.boolean().optional(),
  });

export const moveTaskSchema = z.object({
  status: z.enum(["backlog", "week", "tomorrow", "today", "done", "archived"]),
});

export const reorderTasksSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export const bulkMoveSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(50),
  status: z.enum(["backlog", "week", "tomorrow", "today", "done", "archived"]),
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
  status: z.enum(["backlog", "week", "tomorrow", "today", "done", "archived"]).optional(),
});

export const createTimeLogSchema = z.object({
  systemId: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMinutes: z.number().int().min(0),
  source: z.enum(['timer', 'manual', 'pomodoro']).default('timer'),
});

export type CreateTimeLogInput = z.infer<typeof createTimeLogSchema>;
