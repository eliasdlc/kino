import { stickyNotes } from "@/shared/db/schema";

export type StickyNote = typeof stickyNotes.$inferSelect;

export type StickyNoteItem = Pick<
  StickyNote,
  | "id" | "title" | "content" | "color" | "sortIndex"
  | "pageId" | "folderId"
  | "positionSide" | "positionY" | "positionX" | "anchorId" | "stackId" | "textAnchor"
  | "isEureka"
>;
