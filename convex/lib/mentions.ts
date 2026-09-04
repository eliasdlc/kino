import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { detectMentions, plainTextFromHtml } from '../../src/features/entities/entities.detection';

// El índice derivado de menciones: qué entidades del universo nombra cada
// página. Se recalcula al guardar una página y al tocar una entidad.

async function universeOf(ctx: MutationCtx, userId: Id<'users'>, systemId: Id<'systems'>) {
  const docs = await ctx.db
    .query('entities')
    .withIndex('by_system_alive', (q) => q.eq('systemId', systemId).eq('deletedAt', undefined))
    .collect();
  return docs.filter((doc) => doc.userId === userId).map((doc) => ({ id: doc._id, name: doc.name, aliases: doc.aliases }));
}

async function rewritePageMentions(
  ctx: MutationCtx,
  pageId: Id<'pages'>,
  counts: Map<string, number>,
) {
  for (const row of await ctx.db.query('pageEntityMentions').withIndex('by_page_entity', (q) => q.eq('pageId', pageId)).collect()) {
    await ctx.db.delete(row._id);
  }
  for (const [entityId, mentionCount] of counts) {
    await ctx.db.insert('pageEntityMentions', { pageId, entityId: entityId as Id<'entities'>, mentionCount });
  }
}

/** Recalcula las menciones de una página contra el universo de su sistema. */
export async function recomputePageMentions(
  ctx: MutationCtx,
  userId: Id<'users'>,
  pageId: Id<'pages'>,
  systemId: Id<'systems'> | undefined,
  content: string | undefined,
) {
  const universe = systemId ? await universeOf(ctx, userId, systemId) : [];
  const counts = universe.length ? detectMentions(plainTextFromHtml(content), universe) : new Map<string, number>();
  await rewritePageMentions(ctx, pageId, counts);
}

/** Recalcula todas las páginas del sistema: al crear, renombrar o borrar una entidad. */
export async function recomputeSystemMentions(ctx: MutationCtx, userId: Id<'users'>, systemId: Id<'systems'>) {
  const universe = await universeOf(ctx, userId, systemId);
  const pages = await ctx.db.query('pages').withIndex('by_system', (q) => q.eq('systemId', systemId)).collect();
  for (const page of pages) {
    if (page.userId !== userId || page.deletedAt !== undefined) continue;
    const counts = universe.length ? detectMentions(plainTextFromHtml(page.content), universe) : new Map<string, number>();
    await rewritePageMentions(ctx, page._id, counts);
  }
}
