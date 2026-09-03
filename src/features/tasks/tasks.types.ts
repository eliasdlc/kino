import { tasks } from "@/shared/db/schema";
import type { Transport } from "@/shared/api/transport";
import { z } from "zod";
import { createTaskSchema, updateTaskSchema } from "./tasks.schemas";

/** Type-narrowed metadata fields per system type. */
export type TaskMetadata = {
  // academic
  course?: string;
  professor?: string;
  syllabus?: string;
  collaborators?: string[];
  // project
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

/**
 * La tarea tal como llega al cliente: lo mismo que la fila, con las fechas como
 * texto ISO porque eso es lo que sobrevive a un `JSON.stringify`. Es el tipo que
 * usan los hooks y los componentes; `Task` se queda del lado del servidor.
 */
export type TaskTransport = Transport<Task>;

/** Las cuatro prioridades, tal como las declara la columna. */
export type TaskPriority = Task["priority"];

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
