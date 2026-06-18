import { z } from "zod";

export const createPageSchema = z.object({
  systemId: z.string().uuid(),
  folderId: z.string().uuid().optional(),
  parentPageId: z.string().uuid().optional(),
  title: z.string().max(500).optional(),
  content: z.string().nullable().optional(),
});

export const updatePageSchema = z.object({
  title: z.string().max(500).nullable().optional(),
  content: z.string().nullable().optional(),
  folderId: z.string().uuid().nullable().optional(),
  isPinned: z.boolean().optional(),
});

export const linkTaskSchema = z.object({
  taskId: z.string().uuid(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type LinkTaskInput = z.infer<typeof linkTaskSchema>;
