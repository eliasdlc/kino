import { z } from 'zod';

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const updateUserSettingsSchema = z
  .object({
    dailyEnergyLimit: z.number().int().min(1).max(500).optional(),
    timezone: z
      .string()
      .min(1)
      .max(50)
      .refine(isValidTimezone, 'Zona horaria inválida')
      .optional(),
    theme: z.enum(['dark', 'light', 'system']).optional(),
    notificationsEnabled: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.dailyEnergyLimit !== undefined ||
      d.timezone !== undefined ||
      d.theme !== undefined ||
      d.notificationsEnabled !== undefined,
    'Debe incluir al menos un campo',
  );

export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
