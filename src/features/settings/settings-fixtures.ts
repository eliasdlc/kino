import type { FunctionReturnType } from 'convex/server';
import type { api } from '@convex/_generated/api';

/**
 * Los ajustes de una cuenta de prueba, para los tests y los specimens de
 * Ajustes. Uno solo, para que todos cuenten lo mismo de la misma cuenta.
 */
export const AJUSTES_DE_PRUEBA: NonNullable<FunctionReturnType<typeof api.settings.get>> = {
  dailyEnergyLimit: 50,
  timezone: 'America/Santo_Domingo',
  theme: 'system',
  notificationsEnabled: true,
  weeklyReviewDay: 'sun',
  wordsSeen: [],
  reminderIntensity: 'aggressive',
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  morningDigestTime: '08:00',
  emailReminders: true,
};
