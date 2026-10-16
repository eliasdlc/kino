import { z } from "zod";

const colorValues = [
  "red", "blue", "pink", "purple", "green",
  "orange", "yellow", "teal", "gray", "black", "white",
] as const;

// `metadata` entra como passthrough laxo.
export const createFolderSchema = z.object({
  academicPeriodId: z.string().optional(),
  name: z.string().min(1).max(255),
  systemId: z.string(),
  color: z.enum(colorValues).optional(),
  parentId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z.enum(colorValues).optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
