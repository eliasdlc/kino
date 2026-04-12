import { z } from 'zod';

export const createTaskSchema = z.object({
  systemId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["backlog", "week", "today", "done", "archived"]).optional(),
  energyLevel: z.enum(["high", "medium", "low"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  taskType: z.enum(["idea", "reminder", "project", "todo"]).optional(),
  dueDate: z.string().date().optional(),
  startDate: z.string().date(),
  estimatedTime: z.string().time().optional(),
  parentTaskId: z.string().uuid().optional(),
  contextTagId: z.string().uuid().optional(),
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .omit({ systemId: true })
  .extend({ startDate: z.string().date().optional() });

export const moveTaskSchema = z.object({
  status: z.enum(["backlog", "week", "today", "done", "archived"]),
});

export const reorderTasksSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});
