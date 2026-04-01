import { tasks } from "@/shared/db/schema";
import { z } from "zod";
import { createTaskSchema, updateTaskSchema } from "./tasks.schemas";

export type Task = typeof tasks.$inferSelect;

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;