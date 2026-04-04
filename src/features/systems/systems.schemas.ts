import { z } from 'zod';

export const createSystemSchema = z.object({
  name: z.string().min(1).max(255),
  identityStatement: z.string().max(500),
  templateType: z.enum(["academic", "professional", "entrepreneurial", "personal", "custom"]),
  energyIdeal: z.enum(["high", "medium", "low"]).optional(),
  color: z.enum(["red", "blue", "pink", "purple", "green", "orange", "yellow", "teal", "gray", "black", "white"]),
  icon: z.string().max(50).default("folder"),
  expectedFrequency: z.string().max(20),
  triggerContext: z.string().max(255)
});

export const updateSystemSchema = createSystemSchema.partial();

export const reorderSystemsSchema = z.object({
  systemIds: z.array(z.string().uuid()),
});
