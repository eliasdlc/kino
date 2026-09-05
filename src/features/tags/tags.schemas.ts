import { z } from "zod";

const colorValues = [
  "red", "blue", "pink", "purple", "green",
  "orange", "yellow", "teal", "gray", "black", "white",
] as const;

export const createTagSchema = z.object({
  title: z.string().min(1).max(24),
  color: z.enum(colorValues).optional(),
  // null/ausente → tag global del usuario; con valor → tag específico del sistema.
  systemId: z.string().nullable().optional(),
});

export const updateTagSchema = z.object({
  title: z.string().min(1).max(24).optional(),
  color: z.enum(colorValues).optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
