import { z } from 'zod';
import type { Doc } from './_generated/dataModel';
import { kinoZodMutation, kinoZodQuery, type Caller } from './lib/fn';
import { vocabularyWord, type VocabularyWord } from './schema';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { programarResumen, recalcularAvisosDe } from './lib/avisos';
import { INTENSIDAD_POR_DEFECTO, RESUMEN_POR_DEFECTO, SILENCIO_POR_DEFECTO } from './lib/recordatorios';

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

/** Un reloj 'HH:MM' de 24 horas. */
const CLOCK = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida');

export const updateUserSettingsSchema = z
  .object({
    dailyEnergyLimit: z.number().int().min(1).max(500).optional(),
    timezone: z.string().min(1).max(50).refine(isValidTimezone, 'Zona horaria inválida').optional(),
    theme: z.enum(['dark', 'light', 'system']).optional(),
    notificationsEnabled: z.boolean().optional(),
    weeklyReviewDay: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']).optional(),
    reminderIntensity: z.enum(['aggressive', 'medium', 'low']).optional(),
    quietHoursStart: CLOCK.optional(),
    quietHoursEnd: CLOCK.optional(),
    morningDigestTime: CLOCK.optional(),
    emailReminders: z.boolean().optional(),
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
    wordsSeen: row?.wordsSeen ?? [],
    reminderIntensity: row?.reminderIntensity ?? INTENSIDAD_POR_DEFECTO,
    quietHoursStart: row?.quietHoursStart ?? SILENCIO_POR_DEFECTO.desde,
    quietHoursEnd: row?.quietHoursEnd ?? SILENCIO_POR_DEFECTO.hasta,
    morningDigestTime: row?.morningDigestTime ?? RESUMEN_POR_DEFECTO,
    emailReminders: row?.emailReminders ?? true,
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
  else {
    await ctx.db.insert('userSettings', { ...defaultSettings(userId, now), ...patch });
    // Una fila nueva nace con su primer resumen programado: sin él, el cron
    // no la encontraría nunca por su índice.
    await programarResumen(ctx, userId, now);
  }
}

/**
 * Recordar que una palabra del vocabulario ya apareció.
 *
 * Se llama cuando la puerta se **enseña**, no cuando se acepta: la regla es que
 * cada palabra aparece una vez, y quien la ignora no vuelve a verla. Insistir
 * sería un tercer empuje del sistema y el producto tiene dos.
 *
 * Idempotente a propósito: la puerta puede montarse dos veces en el mismo
 * render de React y eso no es dos apariciones.
 */
export const markWordSeen = kinoZodMutation({
  args: { word: z.enum(vocabularyWord.members.map((m) => m.value) as [VocabularyWord, ...VocabularyWord[]]) },
  handler: async (ctx, { word }) => {
    const row = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', ctx.user._id))
      .unique();
    const seen = row?.wordsSeen ?? [];
    if (seen.includes(word)) return { ok: true as const };
    await upsertSettings(ctx, ctx.user._id, { wordsSeen: [...seen, word] });
    return { ok: true as const };
  },
});

export const update = kinoZodMutation({
  args: updateUserSettingsSchema,
  handler: async (ctx, input) => {
    const patch: Partial<Doc<'userSettings'>> = {};
    if (input.dailyEnergyLimit !== undefined) patch.dailyEnergyLimit = input.dailyEnergyLimit;
    if (input.theme !== undefined) patch.theme = input.theme;
    if (input.notificationsEnabled !== undefined) patch.notificationsEnabled = input.notificationsEnabled;
    if (input.weeklyReviewDay !== undefined) patch.weeklyReviewDay = input.weeklyReviewDay;
    if (input.reminderIntensity !== undefined) patch.reminderIntensity = input.reminderIntensity;
    if (input.quietHoursStart !== undefined) patch.quietHoursStart = input.quietHoursStart;
    if (input.quietHoursEnd !== undefined) patch.quietHoursEnd = input.quietHoursEnd;
    if (input.morningDigestTime !== undefined) patch.morningDigestTime = input.morningDigestTime;
    if (input.emailReminders !== undefined) patch.emailReminders = input.emailReminders;
    if (Object.keys(patch).length > 0) await upsertSettings(ctx, ctx.user._id, patch);
    if (input.timezone !== undefined) await ctx.db.patch(ctx.user._id, { timezone: input.timezone, updatedAt: Date.now() });

    // Lo que mueve el calendario de avisos: la zona, el silencio, la
    // intensidad y el interruptor general. Los avisos ya escritos en cada
    // tarea se recalculan, y el resumen se reprograma a su hora nueva.
    const mueveAvisos = ['timezone', 'quietHoursStart', 'quietHoursEnd', 'reminderIntensity', 'notificationsEnabled'].some(
      (k) => input[k as keyof typeof input] !== undefined,
    );
    if (mueveAvisos) await recalcularAvisosDe(ctx, ctx.user._id);
    if (mueveAvisos || input.morningDigestTime !== undefined) await programarResumen(ctx, ctx.user._id);
    return settingsOf(ctx, (await ctx.db.get(ctx.user._id))!);
  },
});
