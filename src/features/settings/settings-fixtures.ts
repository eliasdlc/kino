import type { FunctionReturnType } from 'convex/server';
import type { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

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

/** La cuenta de prueba como la devuelve `users.current`, para los tests y los specimens. */
export const CUENTA_DE_PRUEBA: NonNullable<FunctionReturnType<typeof api.users.current>> = {
  _id: 'u1' as Id<'users'>,
  _creationTime: 0,
  email: 'ana@usekino.dev',
  name: 'Ana Prueba',
  onboardingCompleted: true,
  status: 'active',
  timezone: 'America/Santo_Domingo',
  createdAt: 0,
  updatedAt: 0,
};
