import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { tasks } from "@/shared/db/schema";
import type { CreateTaskInput as ConvexCreateTaskInput, UpdateTaskInput as ConvexUpdateTaskInput } from "@convex/lib/tasks/schemas";
import type { Loose } from "@/shared/convex/loose";

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

/**
 * La fila de Postgres, que sólo siguen usando los módulos puros de energía e
 * insights a través del adaptador de Convex. Se va con el schema de Drizzle.
 */
export type Task = typeof tasks.$inferSelect;

/**
 * La tarea tal como llega al cliente: lo que devuelve Convex, con las fechas
 * como texto ISO. Es el tipo que usan los hooks y los componentes.
 */
export type TaskTransport = FunctionReturnType<typeof api.tasks.byId>;

/** Las cuatro prioridades. */
export type TaskPriority = TaskTransport["priority"];

/** Lo que escribe el cliente, con los ids como texto llano. */
export type CreateTaskInput = Loose<ConvexCreateTaskInput>;
export type UpdateTaskInput = Loose<ConvexUpdateTaskInput>;
