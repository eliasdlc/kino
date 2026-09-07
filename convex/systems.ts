import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { githubRepoRefSchema } from '../src/features/github-sync/github-sync.schemas';
import { deriveStale } from '../src/features/systems/systems.signals';
import { TEMPLATE_TYPE_VALUES } from '../src/shared/types/enums';
import { forbidden, notFound } from './lib/errors';
import { kinoZodMutation, kinoZodQuery, type Channel } from './lib/fn';
import { color } from './schema';

// Los sistemas: el segundo hub del schema. Borrar es desactivar, así que las
// tareas y carpetas que cuelgan de uno no se tocan.

const COLORS = color.members.map((m) => m.value) as [string, ...string[]];
const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());

/** El sistema tal como lo ve el cliente. */
export function systemItem(doc: Doc<'systems'>) {
  return {
    id: doc._id,
    userId: doc.userId,
    name: doc.name,
    color: doc.color,
    identityStatement: doc.identityStatement ?? null,
    templateType: doc.templateType,
    energyIdeal: doc.energyIdeal ?? null,
    icon: doc.icon,
    isActive: doc.isActive,
    isInbox: doc.isInbox,
    expectedFrequency: doc.expectedFrequency ?? null,
    triggerContext: doc.triggerContext ?? null,
    metadata: doc.metadata ?? null,
    sortOrder: doc.sortOrder,
    createdAt: iso(doc.createdAt)!,
    updatedAt: iso(doc.updatedAt)!,
  };
}
export type SystemItem = ReturnType<typeof systemItem>;

async function ownSystem(ctx: QueryCtx | MutationCtx, userId: Id<'users'>, id: Id<'systems'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId) notFound('System not found');
  return doc;
}

const systemFields = {
  name: z.string().min(1).max(255),
  identityStatement: z.string().max(500).optional(),
  templateType: z.enum(TEMPLATE_TYPE_VALUES).optional(),
  energyIdeal: z.enum(['high', 'medium', 'low']).optional(),
  color: z.enum(COLORS),
  icon: z.string().max(50).default('folder'),
  expectedFrequency: z.string().max(20).optional(),
  triggerContext: z.string().max(255).optional(),
};

const tabId = z.enum(['backlog', 'planning', 'action', 'archive']);
const noun = z.string().trim().min(1).max(24);
export const systemMetadataSchema = z.object({
  tabs: z.array(tabId).optional(),
  defaultTab: tabId.optional(),
  composition: z
    .object({
      containers: z.object({ enabled: z.boolean(), noun, nounPlural: noun }).optional(),
      pages: z.object({ noun, nounPlural: noun, primary: z.boolean() }).optional(),
      taskKinds: z
        .array(z.object({ id: z.string().min(1).max(40), label: z.string().trim().min(1).max(32) }))
        .max(8)
        .optional(),
    })
    .optional(),
  dailyWordGoal: z.coerce.number().int().min(0).max(100_000).optional(),
  chekhov: z
    .object({
      maxMentions: z.coerce.number().int().min(1).max(50),
      minSilentChapters: z.coerce.number().int().min(1).max(50),
    })
    .optional(),
  github: githubRepoRefSchema.optional(),
});

// ── Lecturas ────────────────────────────────────────────────────────────────

/**
 * Los sistemas activos con sus señales: cuántas tareas vivas tienen y cuánto
 * hace que no registran actividad, que es lo que decide si están parados.
 */
export const list = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.user._id;
    const docs = await ctx.db
      .query('systems')
      .withIndex('by_user_active', (q) => q.eq('userId', userId).eq('isActive', true))
      .collect();
    const now = Date.now();
    const days = (from: number) => Math.floor((now - from) / 86_400_000);

    const items = [];
    for (const system of docs.sort((a, b) => a.sortOrder - b.sortOrder)) {
      const tasks = await ctx.db
        .query('tasks')
        .withIndex('by_system_alive_status', (q) => q.eq('systemId', system._id).eq('deletedAt', undefined))
        .collect();
      const logs = await ctx.db
        .query('timeLogs')
        .withIndex('by_system_started', (q) => q.eq('systemId', system._id))
        .collect();
      const activeTaskCount = tasks.filter((task) => task.status !== 'done').length;
      const lastActivity = Math.max(
        ...tasks.map((task) => task.completedAt ?? 0),
        ...logs.map((log) => log.createdAt),
      );
      const daysSinceLastActivity = lastActivity > 0 ? days(lastActivity) : null;
      const stale = system.isInbox
        ? false
        : deriveStale({
            expectedFrequency: system.expectedFrequency,
            activeTaskCount,
            daysSinceLastActivity,
            daysSinceCreated: days(system.createdAt),
          });
      items.push({ ...systemItem(system), stale, daysSinceLastActivity, activeTaskCount });
    }
    return items;
  },
});

export const byId = kinoZodQuery({
  args: { id: zid('systems') },
  handler: async (ctx, { id }) => {
    const doc = await ownSystem(ctx, ctx.user._id, id);
    if (!doc.isActive) notFound('System not found');
    return systemItem(doc);
  },
});

// ── Escrituras ──────────────────────────────────────────────────────────────

/** La bandeja de entrada, una por persona. Crearla dos veces no hace nada. */
export const setup = kinoZodMutation({
  args: {},
  handler: async (ctx) => {
    const inbox = await ctx.db
      .query('systems')
      .withIndex('by_user_inbox', (q) => q.eq('userId', ctx.user._id).eq('isInbox', true))
      .first();
    if (inbox) return { ok: true as const };
    const now = Date.now();
    await ctx.db.insert('systems', {
      userId: ctx.user._id,
      name: 'Inbox',
      color: 'blue',
      templateType: 'inbox',
      icon: 'inbox',
      isActive: true,
      isInbox: true,
      sortOrder: 0,
      createdBy: ctx.user._id,
      createdVia: 'system',
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true as const };
  },
});

export const create = kinoZodMutation({
  args: systemFields,
  handler: async (ctx, input) => createSystemDoc(ctx, ctx.user._id, ctx.channel, input),
});

/** Crea el sistema con sus etiquetas de proyecto. Exportada para el onboarding. */
export async function createSystemDoc(
  ctx: MutationCtx,
  userId: Id<'users'>,
  channel: Channel,
  input: z.infer<z.ZodObject<typeof systemFields>>,
) {
  {
    const existing = await ctx.db
      .query('systems')
      .withIndex('by_user_sort', (q) => q.eq('userId', userId))
      .collect();
    const now = Date.now();
    const id = await ctx.db.insert('systems', {
      userId,
      name: input.name,
      color: input.color as Doc<'systems'>['color'],
      identityStatement: input.identityStatement,
      templateType: input.templateType ?? 'custom',
      energyIdeal: input.energyIdeal ?? 'medium',
      icon: input.icon,
      isActive: true,
      isInbox: false,
      expectedFrequency: input.expectedFrequency ?? 'daily',
      triggerContext: input.triggerContext ?? '',
      // Los agentes de un miembro invitado no escriben aquí hasta que el dueño
      // lo permita a mano.
      memberAgentsAllowed: false,
      sortOrder: Math.max(-1, ...existing.map((s) => s.sortOrder)) + 1,
      createdBy: userId,
      createdVia: channel,
      createdAt: now,
      updatedAt: now,
    });
    // Un proyecto nace con sus categorías: bug, feature, chore.
    if ((input.templateType ?? 'custom') === 'project') {
      for (const [title, tint] of [['Bug', 'red'], ['Feature', 'blue'], ['Chore', 'gray']] as const) {
        await ctx.db.insert('contextTags', { userId, systemId: id, title, color: tint, isDefault: true, createdAt: now });
      }
    }
    return systemItem((await ctx.db.get(id))!);
  }
}

export const update = kinoZodMutation({
  args: {
    id: zid('systems'),
    name: systemFields.name.optional(),
    identityStatement: systemFields.identityStatement,
    templateType: systemFields.templateType,
    energyIdeal: systemFields.energyIdeal,
    color: systemFields.color.optional(),
    icon: z.string().max(50).optional(),
    expectedFrequency: systemFields.expectedFrequency,
    triggerContext: systemFields.triggerContext,
    metadata: systemMetadataSchema.nullable().optional(),
  },
  handler: async (ctx, { id, ...data }) => {
    const system = await ownSystem(ctx, ctx.user._id, id);
    if (system.isInbox) forbidden('Cannot modify or delete the Inbox system');
    const patch: Partial<Doc<'systems'>> = { updatedAt: Date.now() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.identityStatement !== undefined) patch.identityStatement = data.identityStatement;
    if (data.templateType !== undefined) patch.templateType = data.templateType;
    if (data.energyIdeal !== undefined) patch.energyIdeal = data.energyIdeal;
    if (data.color !== undefined) patch.color = data.color as Doc<'systems'>['color'];
    if (data.icon !== undefined) patch.icon = data.icon;
    if (data.expectedFrequency !== undefined) patch.expectedFrequency = data.expectedFrequency;
    if (data.triggerContext !== undefined) patch.triggerContext = data.triggerContext;
    if (data.metadata !== undefined) patch.metadata = data.metadata ?? undefined;
    await ctx.db.patch(id, patch);
    return systemItem((await ctx.db.get(id))!);
  },
});

export const remove = kinoZodMutation({
  args: { id: zid('systems') },
  handler: async (ctx, { id }) => {
    const system = await ownSystem(ctx, ctx.user._id, id);
    if (system.isInbox) forbidden('Cannot deactivate Inbox');
    await ctx.db.patch(id, { isActive: false, updatedAt: Date.now() });
    return null;
  },
});

export const reorder = kinoZodMutation({
  args: { systemIds: z.array(zid('systems')) },
  handler: async (ctx, { systemIds }) => {
    const now = Date.now();
    for (const [index, id] of systemIds.entries()) {
      const system = await ctx.db.get(id);
      if (!system || system.userId !== ctx.user._id) continue;
      await ctx.db.patch(id, { sortOrder: index, updatedAt: now });
    }
    return null;
  },
});
