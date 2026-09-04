import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { notFound } from './lib/errors';
import { kinoZodMutation, kinoZodQuery } from './lib/fn';

// Iteraciones del tipo de sistema `project`. Al cerrarse, las tarjetas
// conservan su sprint y se ven agrupadas bajo él en las archivadas.

const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());
const DATE = z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid date' });

export function sprintItem(doc: Doc<'sprints'>) {
  return {
    id: doc._id,
    userId: doc.userId,
    systemId: doc.systemId,
    name: doc.name,
    goal: doc.goal ?? null,
    startDate: iso(doc.startDate),
    endDate: iso(doc.endDate),
    status: doc.status,
    completedAt: iso(doc.completedAt),
    sortOrder: doc.sortOrder,
    externalId: doc.externalId ?? null,
    createdAt: iso(doc.createdAt)!,
    updatedAt: iso(doc.updatedAt)!,
  };
}
export type SprintItem = ReturnType<typeof sprintItem>;

async function ownSprint(ctx: QueryCtx | MutationCtx, userId: Id<'users'>, id: Id<'sprints'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId) notFound('Sprint not found');
  return doc;
}

export const bySystem = kinoZodQuery({
  args: { systemId: zid('systems') },
  handler: async (ctx, { systemId }) => {
    const docs = await ctx.db
      .query('sprints')
      .withIndex('by_system_status', (q) => q.eq('systemId', systemId))
      .collect();
    return docs.filter((doc) => doc.userId === ctx.user._id).sort((a, b) => a.sortOrder - b.sortOrder).map(sprintItem);
  },
});

export const create = kinoZodMutation({
  args: {
    systemId: zid('systems'),
    name: z.string().min(1).max(255),
    goal: z.string().max(500).optional(),
    startDate: DATE.optional(),
    endDate: DATE.optional(),
  },
  handler: async (ctx, input) => {
    const system = await ctx.db.get(input.systemId);
    if (!system || system.userId !== ctx.user._id) notFound('System not found');
    const siblings = await ctx.db
      .query('sprints')
      .withIndex('by_system_status', (q) => q.eq('systemId', input.systemId))
      .collect();
    const now = Date.now();
    const id = await ctx.db.insert('sprints', {
      userId: ctx.user._id,
      systemId: input.systemId,
      name: input.name,
      goal: input.goal,
      startDate: input.startDate ? Date.parse(input.startDate) : undefined,
      endDate: input.endDate ? Date.parse(input.endDate) : undefined,
      status: 'active',
      sortOrder: Math.max(-1, ...siblings.map((s) => s.sortOrder)) + 1,
      createdAt: now,
      updatedAt: now,
    });
    return sprintItem((await ctx.db.get(id))!);
  },
});

export const update = kinoZodMutation({
  args: {
    id: zid('sprints'),
    name: z.string().min(1).max(255).optional(),
    goal: z.string().max(500).nullable().optional(),
    startDate: DATE.nullable().optional(),
    endDate: DATE.nullable().optional(),
    status: z.enum(['active', 'completed']).optional(),
  },
  handler: async (ctx, { id, ...data }) => {
    await ownSprint(ctx, ctx.user._id, id);
    const now = Date.now();
    const patch: Partial<Doc<'sprints'>> = { updatedAt: now };
    if (data.name !== undefined) patch.name = data.name;
    if (data.goal !== undefined) patch.goal = data.goal ?? undefined;
    if (data.startDate !== undefined) patch.startDate = data.startDate ? Date.parse(data.startDate) : undefined;
    if (data.endDate !== undefined) patch.endDate = data.endDate ? Date.parse(data.endDate) : undefined;
    if (data.status !== undefined) {
      patch.status = data.status;
      patch.completedAt = data.status === 'completed' ? now : undefined;
    }
    await ctx.db.patch(id, patch);
    return sprintItem((await ctx.db.get(id))!);
  },
});

export const close = kinoZodMutation({
  args: { id: zid('sprints') },
  handler: async (ctx, { id }) => {
    await ownSprint(ctx, ctx.user._id, id);
    const now = Date.now();
    await ctx.db.patch(id, { status: 'completed', completedAt: now, updatedAt: now });
    return sprintItem((await ctx.db.get(id))!);
  },
});

/** Borra el sprint; sus tarjetas se quedan sin sprint, no se van. */
export const remove = kinoZodMutation({
  args: { id: zid('sprints') },
  handler: async (ctx, { id }) => {
    await ownSprint(ctx, ctx.user._id, id);
    const now = Date.now();
    for (const task of await ctx.db.query('tasks').withIndex('by_sprint', (q) => q.eq('sprintId', id)).collect()) {
      await ctx.db.patch(task._id, { sprintId: undefined, updatedAt: now });
    }
    await ctx.db.delete(id);
    return null;
  },
});
