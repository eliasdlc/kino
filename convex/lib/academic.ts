import type { Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { invalid, notFound } from './errors';

export async function academicSystem(ctx: QueryCtx, userId: Id<'users'>, systemId: Id<'systems'>) {
  const system = await ctx.db.get(systemId);
  if (!system || system.userId !== userId || !system.isActive) notFound('System not found');
  if (system.templateType !== 'academic') invalid('Only academic systems have cycles');
  return system;
}

export async function ownPeriod(ctx: QueryCtx, userId: Id<'users'>, id: Id<'academicPeriods'>, systemId?: Id<'systems'>) {
  const period = await ctx.db.get(id);
  if (!period || period.userId !== userId || (systemId && period.systemId !== systemId)) notFound('Cycle not found');
  await academicSystem(ctx, userId, period.systemId);
  return period;
}

/** El período se hereda de la materia raíz; las subcarpetas no pueden contradecirlo. */
export async function academicFolderIds(ctx: QueryCtx, userId: Id<'users'>, systemId: Id<'systems'>, periodId: Id<'academicPeriods'> | null) {
  await academicSystem(ctx, userId, systemId);
  if (periodId) await ownPeriod(ctx, userId, periodId, systemId);
  const folders = (await ctx.db.query('folders').withIndex('by_system', q => q.eq('systemId', systemId)).collect())
    .filter(f => f.userId === userId && f.deletedAt === undefined);
  const byId = new Map(folders.map(f => [f._id, f]));
  return new Set(folders.filter(folder => {
    let root = folder;
    const visited = new Set<string>();
    while (root.parentId && byId.has(root.parentId) && !visited.has(root._id)) {
      visited.add(root._id);
      root = byId.get(root.parentId)!;
    }
    return (root.academicPeriodId ?? null) === periodId;
  }).map(f => f._id));
}
