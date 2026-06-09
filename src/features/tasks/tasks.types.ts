import { tasks } from "@/shared/db/schema";
import { z } from "zod";
import { createTaskSchema, updateTaskSchema } from "./tasks.schemas";

/** Type-narrowed metadata fields per system type. */
export type TaskMetadata = {
  // academic
  course?: string;
  professor?: string;
  syllabus?: string;
  collaborators?: string[];
  // professional
  project?: string;
  assignee?: string;
  dependencies?: string[];
  reviewer?: string;
  // entrepreneurial
  milestone?: string;
  kpi?: string;
  hypothesis?: string;
  learnings?: string;
  // personal
  why?: string;
  [key: string]: unknown;
};

export type Task = typeof tasks.$inferSelect;

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
