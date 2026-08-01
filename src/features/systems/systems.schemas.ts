import { z } from 'zod';
import { TEMPLATE_TYPE_VALUES } from '@/shared/types/enums';

export const createSystemSchema = z.object({
  name: z.string().min(1).max(255),
  identityStatement: z.string().max(500).optional(),
  // Deriva del set único de tipos seleccionables (incluye writing; excluye inbox,
  // que se crea de forma programática). Un arquetipo nuevo entra sin tocar esto.
  templateType: z.enum(TEMPLATE_TYPE_VALUES).optional(),
  energyIdeal: z.enum(["high", "medium", "low"]).optional(),
  color: z.enum(["red", "blue", "pink", "purple", "green", "orange", "yellow", "teal", "gray", "black", "white"]),
  icon: z.string().max(50).default("folder"),
  expectedFrequency: z.string().max(20).optional(),
  triggerContext: z.string().max(255).optional(),
});

const systemTabIdSchema = z.enum(["backlog", "planning", "action", "archive"]);

export const systemMetadataSchema = z.object({
  tabs: z.array(systemTabIdSchema).optional(),
  defaultTab: systemTabIdSchema.optional(),
  // Solo Writing: meta diaria de palabras. 0 la desactiva sin borrar la clave.
  dailyWordGoal: z.coerce.number().int().min(0).max(100_000).optional(),
});

export const updateSystemSchema = createSystemSchema.partial().extend({
  metadata: systemMetadataSchema.nullable().optional(),
});

export const reorderSystemsSchema = z.object({
  systemIds: z.array(z.string().uuid()),
});
