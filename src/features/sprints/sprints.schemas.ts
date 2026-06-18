import { z } from "zod";

// startDate/endDate aceptan "yyyy-MM-dd" o ISO datetime (se parsean a Date en el service).
const DATE = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: "Invalid date",
});

export const createSprintSchema = z.object({
  systemId: z.string().uuid(),
  name: z.string().min(1).max(255),
  goal: z.string().max(500).optional(),
  startDate: DATE.optional(),
  endDate: DATE.optional(),
});

export const updateSprintSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  goal: z.string().max(500).nullable().optional(),
  startDate: DATE.nullable().optional(),
  endDate: DATE.nullable().optional(),
  status: z.enum(["active", "completed"]).optional(),
});

export type CreateSprintInput = z.infer<typeof createSprintSchema>;
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;
