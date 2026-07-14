import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { userSettings, users } from '@/shared/db/schema';
import type { UpdateUserSettingsInput } from './settings.schemas';

const DEFAULT_DAILY_ENERGY_LIMIT = 50;

export type UiTheme = 'dark' | 'light' | 'system';

export interface UserSettings {
  dailyEnergyLimit: number;
  timezone: string;
  theme: UiTheme;
  notificationsEnabled: boolean;
}

/** Lee los ajustes editables del usuario. Si no hay fila (pre-onboarding),
 *  devuelve los defaults del schema. */
export async function getUserSettings(userId: string): Promise<UserSettings> {
  const [[settingsRow], [userRow]] = await Promise.all([
    db
      .select({
        dailyEnergyLimit: userSettings.dailyEnergyLimit,
        theme: userSettings.theme,
        notificationsEnabled: userSettings.notificationsEnabled,
      })
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
    theme: settingsRow?.theme ?? 'system',
    notificationsEnabled: settingsRow?.notificationsEnabled ?? true,
  };
}

/** Upsert: la fila de user_settings puede no existir todavía.
 *  El timezone vive en users (lo usan los crons de notificaciones). */
export async function updateUserSettings(
  userId: string,
  input: UpdateUserSettingsInput,
): Promise<UserSettings> {
  // Los campos que viven en user_settings se upsertean juntos: si la fila no
  // existe, un solo insert la crea con los valores presentes.
  const settingsPatch: Partial<typeof userSettings.$inferInsert> = {};
  if (input.dailyEnergyLimit !== undefined) settingsPatch.dailyEnergyLimit = input.dailyEnergyLimit;
  if (input.theme !== undefined) settingsPatch.theme = input.theme;
  if (input.notificationsEnabled !== undefined) settingsPatch.notificationsEnabled = input.notificationsEnabled;

  if (Object.keys(settingsPatch).length > 0) {
    await db
      .insert(userSettings)
      .values({ userId, ...settingsPatch })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: { ...settingsPatch, updatedAt: new Date() },
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
