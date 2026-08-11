import { z } from "zod";

export const colorValues = [
  "red", "blue", "pink", "purple", "green",
  "orange", "yellow", "teal", "gray", "black", "white",
] as const;

// `metadata` entra como passthrough laxo aquí; el validador real es discriminado
// por systemType (folders.metadata.ts) y corre en la ruta, donde se conoce el
// arquetipo del sistema dueño.
export const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  systemId: z.string().uuid(),
  color: z.enum(colorValues).optional(),
  parentId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  color: z.enum(colorValues).optional(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
