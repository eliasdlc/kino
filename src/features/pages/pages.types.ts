import { pages, tasks } from "@/shared/db/schema";

export type Page = typeof pages.$inferSelect;

export type PageListItem = Pick<
  Page,
  "id" | "title" | "folderId" | "systemId" | "isPinned" | "createdAt" | "updatedAt"
>;

export type PageDetail = Page & {
  linkedTasks: LinkedTask[];
};

export type LinkedTask = Pick<
  typeof tasks.$inferSelect,
  "id" | "title" | "status" | "priority" | "energyLevel" | "dueDate"
>;
