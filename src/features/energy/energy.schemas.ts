import { z } from 'zod';

export const CHECKIN_SLOTS = ['morning', 'afternoon', 'evening'] as const;
export type CheckinSlot = (typeof CHECKIN_SLOTS)[number];

export const createCheckinSchema = z.object({
  currentLevel: z.number().int().min(1).max(100),
  sleepQuality: z.enum(['good', 'partial', 'poor']),
  slot: z.enum(CHECKIN_SLOTS).optional(),
});

export const updateCheckinAccuracySchema = z.object({
  accuracy: z.enum(['accurate', 'partial', 'inaccurate']),
  slot: z.enum(CHECKIN_SLOTS).optional(),
});

export type CreateCheckinInput = z.infer<typeof createCheckinSchema>;
export type UpdateAccuracyInput = z.infer<typeof updateCheckinAccuracySchema>;
