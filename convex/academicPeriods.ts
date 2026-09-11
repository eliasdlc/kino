import { recordEvent } from './eventLog';
import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { kinoZodMutation, kinoZodQuery } from './lib/fn';
import { academicSystem, ownPeriod } from './lib/academic';
import { invalid, notFound } from './lib/errors';

// Años y ciclos son estado permanente del sistema, sin retención ni borrado automático.
export const PERIOD_LIMIT = 200;
const fields = {
  year: z.string().trim().min(1).max(40), // Un rótulo de año, no una descripción.
  name: z.string().trim().min(1).max(100), // Nombre visible del ciclo en el árbol.
};
export const list = kinoZodQuery({
  args: { systemId: zid('systems') },
  handler: async (ctx, { systemId }) => {
    await academicSystem(ctx, ctx.user._id, systemId);
    const items = await ctx.db.query('academicPeriods').withIndex('by_system', q => q.eq('systemId', systemId)).take(PERIOD_LIMIT);
    return items.sort((a, b) => b.year.localeCompare(a.year) || a.createdAt - b.createdAt);
  },
});
export const create = kinoZodMutation({
  args: { systemId: zid('systems'), ...fields },
  handler: async (ctx, args) => {
    await academicSystem(ctx, ctx.user._id, args.systemId);
    const periods = await ctx.db.query('academicPeriods').withIndex('by_system', q => q.eq('systemId', args.systemId)).take(PERIOD_LIMIT);
    if (periods.length >= PERIOD_LIMIT) invalid('Se alcanzó el límite de 200 ciclos por sistema');
    if (periods.some(p => p.year.toLowerCase() === args.year.toLowerCase() && p.name.toLowerCase() === args.name.toLowerCase())) invalid('Ese ciclo ya existe en este año');
    const now = Date.now();
    const id = await ctx.db.insert('academicPeriods', { ...args, userId: ctx.user._id, isCurrent: periods.length === 0, isClosed: false, createdAt: now, updatedAt: now });
    await recordEvent(ctx, { userId: ctx.user._id, systemId: args.systemId, actorChannel: ctx.channel, action: 'academic.cycle.create', targetType: 'system', targetId: args.systemId, payload: { periodId: id, year: args.year, name: args.name } });
    return id;
  },
});
export const update = kinoZodMutation({
  args: { id: zid('academicPeriods'), year: fields.year.optional(), name: fields.name.optional(), isCurrent: z.boolean().optional(), isClosed: z.boolean().optional() },
  handler: async (ctx, { id, ...data }) => {
    const period = await ownPeriod(ctx, ctx.user._id, id);
    if (data.isCurrent && (data.isClosed ?? period.isClosed)) invalid('Reabre el ciclo antes de marcarlo actual');
    const periods = await ctx.db.query('academicPeriods').withIndex('by_system', q => q.eq('systemId', period.systemId)).take(PERIOD_LIMIT);
    const year = data.year ?? period.year, name = data.name ?? period.name;
    if (periods.some(p => p._id !== id && p.year.toLowerCase() === year.toLowerCase() && p.name.toLowerCase() === name.toLowerCase())) invalid('Ese ciclo ya existe en este año');
    if (data.isCurrent) for (const other of periods) if (other.isCurrent && other._id !== id) await ctx.db.patch(other._id, { isCurrent: false, updatedAt: Date.now() });
    await ctx.db.patch(id, { ...data, ...(data.isClosed ? { isCurrent: false } : {}), updatedAt: Date.now() });
    await recordEvent(ctx, { userId: ctx.user._id, systemId: period.systemId, actorChannel: ctx.channel, action: 'academic.cycle.update', targetType: 'system', targetId: period.systemId, payload: { periodId: id, ...data } });
  },
});
export const assignSubject = kinoZodMutation({
  args: { folderId: zid('folders'), periodId: zid('academicPeriods').nullable() },
  handler: async (ctx, { folderId, periodId }) => {
    const folder = await ctx.db.get(folderId);
    if (!folder || folder.userId !== ctx.user._id || folder.deletedAt !== undefined || !folder.systemId) notFound('Subject not found');
    await academicSystem(ctx, ctx.user._id, folder.systemId);
    if (folder.parentId) invalid('Asigna el ciclo a la materia raíz');
    if (periodId) await ownPeriod(ctx, ctx.user._id, periodId, folder.systemId);
    await ctx.db.patch(folderId, { academicPeriodId: periodId ?? undefined, updatedAt: Date.now() });
    await recordEvent(ctx, { userId: ctx.user._id, systemId: folder.systemId, actorChannel: ctx.channel, action: 'academic.subject.assign', targetType: 'folder', targetId: folderId, payload: { previousPeriodId: folder.academicPeriodId ?? null, periodId } });
  },
});
