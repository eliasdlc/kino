import { z } from 'zod';

const rechargePresetSchema = z.object({
  label: z.string().min(1).max(50),
  delta: z.number().int().min(-50).max(50),
});

export const setupProfileSchema = z.object({
  chronotype: z.enum(['morning', 'intermediate', 'evening']),
  sleepTypicalHours: z.number().int().min(4).max(12),
  availableHoursPerDay: z.number().int().min(1).max(16),
  rechargePresets: z.array(rechargePresetSchema).max(8).default([]),
  firstSystemName: z.string().min(1).max(100),
});

export type SetupProfileInput = z.infer<typeof setupProfileSchema>;
