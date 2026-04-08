import { folders } from "@/shared/db/schema";

export type Folder = typeof folders.$inferSelect;

export type FolderListItem = Pick<
  Folder,
  "id" | "name" | "color" | "sortIndex" | "parentId" | "systemId"
>;
