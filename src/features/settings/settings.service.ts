import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { userSettings, users } from '@/shared/db/schema';
import type { UpdateUserSettingsInput } from './settings.schemas';

const DEFAULT_DAILY_ENERGY_LIMIT = 50;

export interface UserSettings {
  dailyEnergyLimit: number;
  timezone: string;
}

/** Lee los ajustes editables del usuario. Si no hay fila (pre-onboarding),
 *  devuelve los defaults del schema. */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const [[settingsRow], [userRow]] = await Promise.all([
    db
      .select({ dailyEnergyLimit: userSettings.dailyEnergyLimit })
      .from(userSettings)
      .where(eq(userSettings.userId, userId)),
    db
      .select({ timezone: users.timezone })
      .from(users)
      .where(eq(users.id, userId)),
  ]);

  return {
    dailyEnergyLimit: settingsRow?.dailyEnergyLimit ?? DEFAULT_DAILY_ENERGY_LIMIT,
    timezone: userRow?.timezone ?? 'UTC',
  };
}

/** Upsert: la fila de user_settings puede no existir todavía.
 *  El timezone vive en users (lo usan los crons de notificaciones). */
export async function updateUserSettings(
  userId: string,
  input: UpdateUserSettingsInput,
): Promise<UserSettings> {
  if (input.dailyEnergyLimit !== undefined) {
    await db
      .insert(userSettings)
      .values({ userId, dailyEnergyLimit: input.dailyEnergyLimit })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { dailyEnergyLimit: input.dailyEnergyLimit, updatedAt: new Date() },
      });
  }

  if (input.timezone !== undefined) {
    await db
      .update(users)
      .set({ timezone: input.timezone, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  return getUserSettings(userId);
}
