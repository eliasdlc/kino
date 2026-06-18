import { z } from 'zod';

export const createSystemSchema = z.object({
  name: z.string().min(1).max(255),
  identityStatement: z.string().max(500).optional(),
  templateType: z.enum(["academic", "project", "entrepreneurial", "personal", "custom"]).optional(),
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
});

export const updateSystemSchema = createSystemSchema.partial().extend({
  metadata: systemMetadataSchema.nullable().optional(),
});

export const reorderSystemsSchema = z.object({
  systemIds: z.array(z.string().uuid()),
});
