/**
 * UI-layer enum constants.
 *
 * These mirror the PostgreSQL ENUMs defined in schema.ts but are intentionally
 * decoupled from Drizzle so that UI components don't import from the DB layer.
 * If an enum value is added or removed, update both schema.ts and this file.
 */

export const COLOR_VALUES = [
  "red", "blue", "pink", "purple", "green",
  "orange", "yellow", "teal", "gray", "black", "white",
] as const;
export type ColorValue = (typeof COLOR_VALUES)[number];

export const ENERGY_LEVEL_VALUES = ["high", "medium", "low"] as const;
export type EnergyLevelValue = (typeof ENERGY_LEVEL_VALUES)[number];

export const TASK_STATUS_VALUES = ["backlog", "week", "today", "done", "archived"] as const;
export type TaskStatusValue = (typeof TASK_STATUS_VALUES)[number];

export const TASK_PRIORITY_VALUES = ["critical", "high", "medium", "low"] as const;
export type TaskPriorityValue = (typeof TASK_PRIORITY_VALUES)[number];

export const TASK_TYPE_VALUES = ["idea", "reminder", "project", "todo"] as const;
export type TaskTypeValue = (typeof TASK_TYPE_VALUES)[number];

export const TEMPLATE_TYPE_VALUES = [
  "academic", "professional", "entrepreneurial", "personal", "custom",
] as const;
export type TemplateTypeValue = (typeof TEMPLATE_TYPE_VALUES)[number];

export const FREQUENCY_VALUES = ["daily", "weekly", "monthly"] as const;
export type FrequencyValue = (typeof FREQUENCY_VALUES)[number];
