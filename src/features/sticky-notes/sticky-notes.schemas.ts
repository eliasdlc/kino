import { z } from "zod";

export const colorValues = [
  "red", "blue", "pink", "purple", "green",
  "orange", "yellow", "teal", "gray", "black", "white",
] as const;

export const createStickyNoteSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(500).optional(),
  color: z.enum(colorValues).optional(),
  textAnchor: z.string().nullable().optional(),
  positionSide: z.enum(["left", "right"]).nullable().optional(),
  positionY: z.number().min(0).max(1).nullable().optional(),
  positionX: z.number().min(0).max(1).nullable().optional(),
  anchorId: z.string().nullable().optional(),
  pageId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
});

export const updateStickyNoteSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  content: z.string().max(500).nullable().optional(),
  color: z.enum(colorValues).optional(),
  positionSide: z.enum(["left", "right"]).nullable().optional(),
  positionY: z.number().min(0).max(1).nullable().optional(),
  positionX: z.number().min(0).max(1).nullable().optional(),
  anchorId: z.string().nullable().optional(),
  stackId: z.string().uuid().nullable().optional(),
  textAnchor: z.string().nullable().optional(),
});

export type CreateStickyNoteInput = z.infer<typeof createStickyNoteSchema>;
export type UpdateStickyNoteInput = z.infer<typeof updateStickyNoteSchema>;
