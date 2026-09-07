import { z } from 'zod';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { archetypeEnergyIdeal, ARCHETYPE_IDENTITIES, DEFAULT_IDENTITY, getArchetype } from '../src/features/onboarding/onboarding.archetypes';
import { buildSeedPlan, type SeedPlan, type SeedTask } from '../src/features/onboarding/onboarding.seed';
import { createEnergyProfile } from './energy';
import { createFolderDoc } from './folders';
import { kinoZodMutation, kinoZodQuery, type Channel } from './lib/fn';
import { userToday } from './lib/time';
import { createPageDoc } from './pages';
import { upsertSettings } from './settings';
import { createSystemDoc } from './systems';
import { createTaskDoc } from './tasks';

// El onboarding: perfil de energía, primer sistema y la siembra del arquetipo.
// Es una sola mutación, así que o entra todo o no entra nada.

/** Hora local a la que arranca una tarea sembrada "de hoy". */
const SEED_START_HOUR = 9;

export const status = kinoZodQuery({
  args: {},
  handler: async (ctx) => ({ completed: ctx.user.onboardingCompleted }),
});

const setupProfileSchema = z.object({
  identity: z.enum(ARCHETYPE_IDENTITIES).default(DEFAULT_IDENTITY),
  chronotype: z.enum(['morning', 'intermediate', 'evening']),
  sleepTypicalHours: z.number().int().min(4).max(12),
  availableHoursPerDay: z.number().int().min(1).max(16),
  rechargePresets: z.array(z.object({ label: z.string().min(1).max(50), delta: z.number().int().min(-50).max(50) })).max(8).default([]),
  firstSystemName: z.string().min(1).max(100),
  seedUnits: z.array(z.object({ name: z.string().min(1).max(255), field: z.string().max(100).optional() })).max(6).default([]),
  timezone: z.string().min(1).max(50).optional(),
});

/** Medianoche local del día más las horas dadas, como instante. */
function zonedHourIso(day: string, hour: number, timezone: string): string {
  const guess = Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return new Date(guess - (asUtc - guess)).toISOString();
}

function toTaskInput(systemId: Id<'systems'>, folderId: Id<'folders'> | undefined, task: SeedTask, todayStartIso: string) {
  return {
    systemId,
    title: task.title,
    ...(folderId ? { folderId } : {}),
    ...(task.startsToday ? { startDate: todayStartIso } : {}),
    ...(task.energyLevel ? { energyLevel: task.energyLevel } : {}),
    ...(task.priority ? { priority: task.priority } : {}),
    ...(task.boardStatus ? { boardStatus: task.boardStatus } : {}),
    ...(task.metadata ? { metadata: task.metadata } : {}),
  };
}

async function applySeedPlan(
  ctx: MutationCtx,
  userId: Id<'users'>,
  channel: Channel,
  timezone: string,
  systemId: Id<'systems'>,
  plan: SeedPlan,
) {
  const todayStartIso = zonedHourIso(userToday(timezone), SEED_START_HOUR, timezone);
  for (const task of plan.tasks) await createTaskDoc(ctx, userId, channel, timezone, toTaskInput(systemId, undefined, task, todayStartIso));
  for (const folder of plan.folders) {
    const created = await createFolderDoc(ctx, userId, channel, { systemId, name: folder.name, ...(folder.metadata ? { metadata: folder.metadata } : {}) });
    for (const task of folder.tasks) await createTaskDoc(ctx, userId, channel, timezone, toTaskInput(systemId, created.id, task, todayStartIso));
    if (folder.page) await createPageDoc(ctx, userId, channel, { systemId, folderId: created.id, title: folder.page.title, content: folder.page.content });
  }
}

export const complete = kinoZodMutation({
  args: setupProfileSchema,
  handler: async (ctx, input) => {
    const userId = ctx.user._id;
    const archetype = getArchetype(input.identity);
    const now = Date.now();
    // La zona horaria se guarda antes de sembrar: el estado de una tarea de hoy sale de ella.
    const timezone = input.timezone ?? ctx.user.timezone;
    if (input.timezone) await ctx.db.patch(userId, { timezone, updatedAt: now });
    await createEnergyProfile(ctx, userId, input);
    const energyIdeal = archetypeEnergyIdeal(archetype);
    const system = await createSystemDoc(ctx, userId, ctx.channel, {
      name: input.firstSystemName,
      color: archetype.systemColor,
      icon: archetype.systemIcon,
      templateType: archetype.systemType,
      ...(energyIdeal ? { energyIdeal } : {}),
      ...(archetype.identityStatement ? { identityStatement: archetype.identityStatement } : {}),
    });
    await applySeedPlan(ctx, userId, ctx.channel, timezone, system.id, buildSeedPlan(input.identity, input.firstSystemName, input.seedUnits));
    await upsertSettings(ctx, userId, { archetypeIdentity: input.identity });
    await ctx.db.patch(userId, { onboardingCompleted: true, updatedAt: now });
    return { ok: true as const };
  },
});
