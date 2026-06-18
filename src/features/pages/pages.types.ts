import { pages, tasks } from "@/shared/db/schema";
import type { ContextTagListItem } from "@/features/tags/tags.types";

export type Page = typeof pages.$inferSelect;

export type PageListItem = Pick<
  Page,
  "id" | "title" | "folderId" | "systemId" | "isPinned" | "parentPageId" | "createdAt" | "updatedAt"
> & {
  contentPreview: string | null;
  tags: ContextTagListItem[];
  subPageCount: number;
};

export type PageDetail = Page & {
  linkedTasks: LinkedTask[];
};

export type LinkedTask = Pick<
  typeof tasks.$inferSelect,
  | "id" | "title" | "status" | "priority" | "energyLevel" | "dueDate"
  | "startDate" | "description" | "taskType" | "estimatedTime"
  | "folderId" | "systemId" | "parentTaskId"
>;

// updatePage returns content so the client cache stays consistent
// after a PATCH (no stale gap until the next refetch).
export type PageMutationResult = PageListItem & Pick<Page, "content">;
