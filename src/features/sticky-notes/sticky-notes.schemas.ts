import { z } from "zod";

export const colorValues = [
  "red", "blue", "pink", "purple", "green",
  "orange", "yellow", "teal", "gray", "black", "white",
] as const;

export const createStickyNoteSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(500).optional(),
  color: z.enum(colorValues).optional(),
  // One of pageId or folderId is required — enforced in service, not here
  pageId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
});

export const updateStickyNoteSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  content: z.string().max(500).nullable().optional(),
  color: z.enum(colorValues).optional(),
});

export type CreateStickyNoteInput = z.infer<typeof createStickyNoteSchema>;
export type UpdateStickyNoteInput = z.infer<typeof updateStickyNoteSchema>;
