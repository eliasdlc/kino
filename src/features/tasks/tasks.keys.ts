/**
 * Query key factories for TanStack Query.
 *
 * Extracted into a standalone module (no React hooks, no "use client") so
 * they can be imported from both Server Components (prefetch) and Client
 * Components (useQuery) without dragging in hook dependencies.
 */

export const taskKeys = {
  bySystem: (systemId: string) => ["tasks", "system", systemId] as const,
  subtasks: (taskId: string) => ["tasks", "subtasks", taskId] as const,
  folderTasks: (systemId: string, folderId: string) =>
    ["tasks", "system", systemId, "folder", folderId] as const,
  todayPlan: () => ["tasks", "today-plan"] as const,
  trash: (systemId: string) => ["tasks", "trash", systemId] as const,
};

export const allTasksKey = () => ["tasks", "all"] as const;

export const suggestedTasksKey = () => ["suggested-tasks"] as const;

export const reminderKeys = {
  byTask: (taskId: string) => ["task-reminders", taskId] as const,
};
