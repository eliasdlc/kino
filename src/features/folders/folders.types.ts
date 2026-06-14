import { folders } from "@/shared/db/schema";

export type Folder = typeof folders.$inferSelect;

export type FolderListItem = Pick<
  Folder,
  "id" | "name" | "color" | "sortIndex" | "parentId" | "systemId"
>;

/** A folder in a list, enriched with its direct-content counts for the card UI. */
export type FolderWithCounts = FolderListItem & {
  subfolderCount: number;
  pageCount: number;
};

export type FolderDetail = Pick<
  Folder,
  "id" | "name" | "color" | "sortIndex" | "parentId" | "systemId" | "path"
>;

export type BreadcrumbItem = {
  id: string;
  name: string;
  path: string;
};
