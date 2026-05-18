import { folders } from "@/shared/db/schema";

export type Folder = typeof folders.$inferSelect;

export type FolderListItem = Pick<
  Folder,
  "id" | "name" | "color" | "sortIndex" | "parentId" | "systemId"
>;

export type FolderDetail = Pick<
  Folder,
  "id" | "name" | "color" | "sortIndex" | "parentId" | "systemId" | "path"
>;

export type BreadcrumbItem = {
  id: string;
  name: string;
  path: string;
};
