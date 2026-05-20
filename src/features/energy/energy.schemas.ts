import { z } from 'zod';

export const createCheckinSchema = z.object({
  currentLevel: z.number().int().min(1).max(100),
  sleepQuality: z.enum(['good', 'partial', 'poor']),
});

export type CreateCheckinInput = z.infer<typeof createCheckinSchema>;
