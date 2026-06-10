import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { userSettings } from '@/shared/db/schema';
import type { UpdateUserSettingsInput } from './settings.schemas';

const DEFAULT_DAILY_ENERGY_LIMIT = 50;

export interface UserSettings {
  dailyEnergyLimit: number;
}

/** Lee los ajustes editables del usuario. Si no hay fila (pre-onboarding),
 *  devuelve los defaults del schema. */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const [row] = await db
    .select({ dailyEnergyLimit: userSettings.dailyEnergyLimit })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  return { dailyEnergyLimit: row?.dailyEnergyLimit ?? DEFAULT_DAILY_ENERGY_LIMIT };
}

/** Upsert: la fila de user_settings puede no existir todavía. */
export async function updateUserSettings(
  userId: string,
  input: UpdateUserSettingsInput,
): Promise<UserSettings> {
  const [row] = await db
    .insert(userSettings)
    .values({ userId, dailyEnergyLimit: input.dailyEnergyLimit })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { dailyEnergyLimit: input.dailyEnergyLimit, updatedAt: new Date() },
    })
    .returning({ dailyEnergyLimit: userSettings.dailyEnergyLimit });

  return { dailyEnergyLimit: row.dailyEnergyLimit };
}
