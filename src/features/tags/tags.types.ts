import { contextTags } from "@/shared/db/schema";

export type ContextTag = typeof contextTags.$inferSelect;

export type ContextTagListItem = Pick<
  ContextTag,
  "id" | "title" | "color" | "systemId" | "isDefault"
>;
