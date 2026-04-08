import { z } from "zod";

export const colorValues = [
  "red", "blue", "pink", "purple", "green",
  "orange", "yellow", "teal", "gray", "black", "white",
] as const;

export const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  systemId: z.string().uuid(),
  color: z.enum(colorValues).optional(),
  parentId: z.string().uuid().optional(),
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
