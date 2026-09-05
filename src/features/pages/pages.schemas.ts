import { z } from "zod";
import { clientRequestIdField } from "@/shared/offline/client-request";

export const createPageSchema = z.object({
  systemId: z.string(),
  folderId: z.string().optional(),
  parentPageId: z.string().optional(),
  title: z.string().max(500).optional(),
  content: z.string().nullable().optional(),
  clientRequestId: clientRequestIdField,
});

export const updatePageSchema = z.object({
  title: z.string().max(500).nullable().optional(),
  content: z.string().nullable().optional(),
  folderId: z.string().nullable().optional(),
  isPinned: z.boolean().optional(),
  /**
   * Versión optimista: el `updatedAt` que traía la página cuando se leyó. Si no
   * coincide con el guardado, la escritura no se aplica y responde 409.
   *
   * Se queda en texto ISO a propósito: es lo que la página devuelve al leerla
   * y lo que el conector MCP manda de vuelta, sin conversión por el camino.
   */
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
});

export const linkTaskSchema = z.object({
  taskId: z.string(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type LinkTaskInput = z.infer<typeof linkTaskSchema>;
