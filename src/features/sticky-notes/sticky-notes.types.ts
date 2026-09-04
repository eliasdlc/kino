import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

export type StickyNoteItem = FunctionReturnType<typeof api.stickyNotes.byPage>[number];

export type StickyNote = StickyNoteItem;
