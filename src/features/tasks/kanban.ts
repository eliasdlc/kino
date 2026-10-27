import type { TaskTransport, UpdateTaskInput } from "./tasks.types";

/**
 * Las columnas de Acción, sin React y sin `@dnd-kit`: las comparten el tablero
 * de escritorio (arrastre) y la lista del teléfono (hoja de mover), así que una
 * tarea cae en la misma columna en los dos y moverla escribe lo mismo.
 */

export type KanbanGroupBy = "energy" | "priority" | "project";

export interface KanbanColumn {
  id: string;
  label: string;
  description: string;
}

/** Columna para tareas sin carpeta (proyecto). */
export const NO_PROJECT = "sin-proyecto";

export const ENERGY_COLUMNS: KanbanColumn[] = [
  { id: "high", label: "Energía alta", description: "Tareas que piden mucho foco." },
  { id: "medium", label: "Energía media", description: "Trabajo constante, foco moderado." },
  { id: "low", label: "Energía baja", description: "Tareas ligeras, fáciles de retomar." },
];

export const PRIORITY_COLUMNS: KanbanColumn[] = [
  { id: "critical", label: "Crítica", description: "Deja todo lo demás." },
  { id: "high", label: "Alta", description: "Hazlas pronto." },
  { id: "medium", label: "Media", description: "Prioridad normal." },
  { id: "low", label: "Baja", description: "Cuando haya espacio." },
];

export function kanbanColumns(groupBy: KanbanGroupBy, folders: readonly { id: string; name: string }[]): KanbanColumn[] {
  if (groupBy === "energy") return ENERGY_COLUMNS;
  if (groupBy === "priority") return PRIORITY_COLUMNS;
  return [
    ...folders.map((f) => ({ id: f.id, label: f.name, description: "" })),
    { id: NO_PROJECT, label: "Sin proyecto", description: "Tareas sin carpeta." },
  ];
}

/** En qué columna cae una tarea, según el agrupamiento. */
export function kanbanColumnOf(task: TaskTransport, groupBy: KanbanGroupBy): string {
  if (groupBy === "energy") return task.energyLevel ?? "medium";
  if (groupBy === "priority") return task.priority ?? "medium";
  return task.folderId ?? NO_PROJECT;
}

/** Lo que se escribe al mover una tarea a una columna: el mismo cambio arrastre o hoja. */
export function kanbanMoveData(groupBy: KanbanGroupBy, columnId: string): UpdateTaskInput {
  if (groupBy === "priority") return { priority: columnId as TaskTransport["priority"] };
  if (groupBy === "project") return { folderId: columnId === NO_PROJECT ? null : columnId };
  return { energyLevel: columnId as TaskTransport["energyLevel"] };
}
