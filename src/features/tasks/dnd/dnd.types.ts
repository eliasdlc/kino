import type { TaskTransport } from "../tasks.types";

/**
 * Discriminated union for drag source context.
 * "day" = Planning View column, "unscheduled" = Planning View no-date column,
 * "energy" / "priority" / "project" = Action View columns (grouped by energy, priority or folder/project).
 */
export type DragSourceType = "day" | "unscheduled" | "energy" | "priority" | "project" | "board" | "calendar";

/**
 * Payload attached to every draggable task.
 * dnd-kit passes this through `active.data.current`.
 */
export interface TaskDragData {
  /** The full task object: used by the DragOverlay to render a preview */
  task: TaskTransport;
  /** Which view/column the task was dragged from */
  sourceType: DragSourceType;
  /**
   * Identifier for the source column:
   * - ISO date string for "day" (e.g. "2026-05-19")
   * - "unscheduled" for unscheduled
   * - "high" | "medium" | "low" for energy
   */
  sourceId: string;
}

/** Droppable column identifier for Planning View */
export type PlanningDropId = string; // ISO date or "unscheduled"

/** Droppable column identifier for Action View */
export type EnergyDropId = "high" | "medium" | "low";
