import { z } from 'zod';
import type { Doc } from './_generated/dataModel';
import { kinoZodMutation, kinoZodQuery, type Caller } from './lib/fn';
import type { MutationCtx, QueryCtx } from './_generated/server';

// Los ajustes editables. La zona horaria vive en `users` porque la leen los
// crons; el resto en `userSettings`, que puede no existir antes del onboarding.

const DEFAULT_DAILY_ENERGY_LIMIT = 50;

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
    timezone: z.string().min(1).max(50).refine(isValidTimezone, 'Zona horaria inválida').optional(),
    theme: z.enum(['dark', 'light', 'system']).optional(),
    notificationsEnabled: z.boolean().optional(),
    weeklyReviewDay: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, 'Debe incluir al menos un campo');

async function settingsOf(ctx: QueryCtx | MutationCtx, user: Caller['user']) {
  const row = await ctx.db
    .query('userSettings')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .unique();
  return {
    dailyEnergyLimit: row?.dailyEnergyLimit ?? DEFAULT_DAILY_ENERGY_LIMIT,
    timezone: user.timezone,
    theme: row?.theme ?? 'system',
    notificationsEnabled: row?.notificationsEnabled ?? true,
    weeklyReviewDay: row?.weeklyReviewDay ?? 'sun',
  };
}
export type UserSettings = Awaited<ReturnType<typeof settingsOf>>;

export const get = kinoZodQuery({
  args: {},
  handler: async (ctx) => settingsOf(ctx, ctx.user),
});

/** Fila de ajustes con los valores por defecto del schema de Postgres. */
export function defaultSettings(userId: Doc<'users'>['_id'], now: number): Omit<Doc<'userSettings'>, '_id' | '_creationTime'> {
  return {
    userId,
    onboardingVersion: 1,
    weeklyReviewDay: 'sun',
    dailyResetTime: '00:00',
    dailyEnergyLimit: DEFAULT_DAILY_ENERGY_LIMIT,
    focusTimeoutHours: 3,
    theme: 'system',
    notificationsEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** Crea la fila si no existe y aplica el parche. */
export async function upsertSettings(ctx: MutationCtx, userId: Doc<'users'>['_id'], patch: Partial<Doc<'userSettings'>>) {
  const now = Date.now();
  const row = await ctx.db.query('userSettings').withIndex('by_user', (q) => q.eq('userId', userId)).unique();
  if (row) await ctx.db.patch(row._id, { ...patch, updatedAt: now });
  else await ctx.db.insert('userSettings', { ...defaultSettings(userId, now), ...patch });
}

export const update = kinoZodMutation({
  args: updateUserSettingsSchema,
  handler: async (ctx, input) => {
    const patch: Partial<Doc<'userSettings'>> = {};
    if (input.dailyEnergyLimit !== undefined) patch.dailyEnergyLimit = input.dailyEnergyLimit;
    if (input.theme !== undefined) patch.theme = input.theme;
    if (input.notificationsEnabled !== undefined) patch.notificationsEnabled = input.notificationsEnabled;
    if (input.weeklyReviewDay !== undefined) patch.weeklyReviewDay = input.weeklyReviewDay;
    if (Object.keys(patch).length > 0) await upsertSettings(ctx, ctx.user._id, patch);
    if (input.timezone !== undefined) await ctx.db.patch(ctx.user._id, { timezone: input.timezone, updatedAt: Date.now() });
    return settingsOf(ctx, (await ctx.db.get(ctx.user._id))!);
  },
});
