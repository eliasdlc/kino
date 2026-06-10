import { z } from 'zod';

export const updateUserSettingsSchema = z.object({
  dailyEnergyLimit: z.number().int().min(1).max(500),
});

export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
