import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import {
  ENTITY_TYPES,
  parseEntityAttributes,
  type EntityAttributes,
  type EntityType,
} from '../src/features/entities/entities.attributes';
import type { UniverseGraph } from '../src/features/entities/entities.graph';
import { forbidden, notFound } from './lib/errors';
import { kinoZodMutation, kinoZodQuery } from './lib/fn';
import { recomputeSystemMentions } from './lib/mentions';

// El codex del universo: entidades, relaciones y el grafo que forman. El
// universo es del sistema, así que dos obras del mismo sistema lo comparten.

type Ctx = QueryCtx | MutationCtx;
const iso = (ms: number) => new Date(ms).toISOString();
const alive = (doc: Doc<'entities'>) => doc.deletedAt === undefined;

export function entityItem(doc: Doc<'entities'>) {
  return {
    id: doc._id,
    systemId: doc.systemId,
    type: doc.type,
    name: doc.name,
    aliases: doc.aliases,
    summary: doc.summary ?? null,
    coverImageUrl: doc.coverImageUrl ?? null,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}
export type EntityItem = ReturnType<typeof entityItem>;

async function ownEntity(ctx: Ctx, userId: Id<'users'>, id: Id<'entities'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId || !alive(doc)) notFound('Entity not found');
  return doc;
}

async function universeOf(ctx: Ctx, userId: Id<'users'>, systemId: Id<'systems'>) {
  const docs = await ctx.db
    .query('entities')
    .withIndex('by_system_alive', (q) => q.eq('systemId', systemId).eq('deletedAt', undefined))
    .collect();
  return docs.filter((doc) => doc.userId === userId).sort((a, b) => a.name.localeCompare(b.name));
}

async function relationsOf(ctx: Ctx, entityId: Id<'entities'>) {
  const [from, to] = await Promise.all([
    ctx.db.query('entityRelations').withIndex('by_from', (q) => q.eq('fromEntityId', entityId)).collect(),
    ctx.db.query('entityRelations').withIndex('by_to', (q) => q.eq('toEntityId', entityId)).collect(),
  ]);
  const items = [];
  for (const rel of [...from, ...to]) {
    const outgoing = rel.fromEntityId === entityId;
    const other = await ctx.db.get(outgoing ? rel.toEntityId : rel.fromEntityId);
    if (!other || !alive(other)) continue;
    items.push({
      id: rel._id,
      label: rel.label ?? null,
      notes: rel.notes ?? null,
      other: { id: other._id, name: other.name, type: other.type },
      outgoing,
    });
  }
  return items;
}
export type EntityRelationItem = Awaited<ReturnType<typeof relationsOf>>[number];

async function appearancesOf(ctx: Ctx, entityId: Id<'entities'>) {
  const mentions = await ctx.db.query('pageEntityMentions').withIndex('by_entity', (q) => q.eq('entityId', entityId)).collect();
  const rows = [];
  for (const mention of mentions) {
    const page = await ctx.db.get(mention.pageId);
    if (!page || page.deletedAt !== undefined) continue;
    rows.push({ pageId: page._id, pageTitle: page.title ?? null, mentionCount: mention.mentionCount, createdAt: page.createdAt });
  }
  return rows.sort((a, b) => a.createdAt - b.createdAt).map(({ createdAt: _createdAt, ...row }) => row);
}

// ── Lecturas ────────────────────────────────────────────────────────────────

export const bySystem = kinoZodQuery({
  args: { systemId: zid('systems') },
  handler: async (ctx, { systemId }) => (await universeOf(ctx, ctx.user._id, systemId)).map(entityItem),
});

export const byId = kinoZodQuery({
  args: { id: zid('entities') },
  handler: async (ctx, { id }) => {
    const doc = await ownEntity(ctx, ctx.user._id, id);
    return {
      ...entityItem(doc),
      attributes: (doc.attributes ?? null) as EntityAttributes | null,
      images: doc.images,
      relations: await relationsOf(ctx, id),
      appearances: await appearancesOf(ctx, id),
    };
  },
});

/** Las entidades que menciona una página, las más nombradas primero. */
export const byPage = kinoZodQuery({
  args: { pageId: zid('pages') },
  handler: async (ctx, { pageId }) => {
    const page = await ctx.db.get(pageId);
    if (!page || page.userId !== ctx.user._id || page.deletedAt !== undefined) return [];
    const mentions = await ctx.db.query('pageEntityMentions').withIndex('by_page_entity', (q) => q.eq('pageId', pageId)).collect();
    const rows = [];
    for (const mention of mentions) {
      const entity = await ctx.db.get(mention.entityId);
      if (!entity || !alive(entity)) continue;
      rows.push({
        id: entity._id,
        name: entity.name,
        type: entity.type,
        summary: entity.summary ?? null,
        coverImageUrl: entity.coverImageUrl ?? null,
        mentionCount: mention.mentionCount,
      });
    }
    return rows.sort((a, b) => b.mentionCount - a.mentionCount || a.name.localeCompare(b.name));
  },
});

/** El universo listo para dibujar: nodos con su peso, aristas y las obras. */
export const graph = kinoZodQuery({
  args: { systemId: zid('systems') },
  handler: async (ctx, { systemId }): Promise<UniverseGraph> => {
    const userId = ctx.user._id;
    const entities = await universeOf(ctx, userId, systemId);
    const folders = (await ctx.db.query('folders').withIndex('by_system', (q) => q.eq('systemId', systemId)).collect())
      .filter((doc) => doc.userId === userId && doc.deletedAt === undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
    const works = folders.map((doc) => ({ id: doc._id, name: doc.name }));
    if (entities.length === 0) return { nodes: [], edges: [], works };

    const aliveIds = new Set<string>(entities.map((doc) => doc._id));
    const totals = new Map<string, number>();
    const worksByEntity = new Map<string, Set<string>>();
    const pages = (await ctx.db.query('pages').withIndex('by_system', (q) => q.eq('systemId', systemId)).collect()).filter(
      (doc) => doc.userId === userId && doc.deletedAt === undefined,
    );
    for (const page of pages) {
      const mentions = await ctx.db.query('pageEntityMentions').withIndex('by_page_entity', (q) => q.eq('pageId', page._id)).collect();
      for (const mention of mentions) {
        totals.set(mention.entityId, (totals.get(mention.entityId) ?? 0) + mention.mentionCount);
        if (!page.folderId) continue;
        const set = worksByEntity.get(mention.entityId) ?? new Set<string>();
        set.add(page.folderId);
        worksByEntity.set(mention.entityId, set);
      }
    }
    const edges = [];
    for (const entity of entities) {
      for (const rel of await ctx.db.query('entityRelations').withIndex('by_from', (q) => q.eq('fromEntityId', entity._id)).collect()) {
        if (aliveIds.has(rel.toEntityId)) edges.push({ id: rel._id, from: rel.fromEntityId, to: rel.toEntityId, label: rel.label ?? null });
      }
    }
    return {
      nodes: entities.map((doc) => ({
        id: doc._id,
        name: doc.name,
        type: doc.type,
        mentionCount: totals.get(doc._id) ?? 0,
        workIds: Array.from(worksByEntity.get(doc._id) ?? []),
      })),
      edges,
      works,
    };
  },
});

// ── Escrituras ──────────────────────────────────────────────────────────────

const rawAttributes = z.record(z.string(), z.unknown()).nullable().optional();
const aliases = z.array(z.string().trim().min(1).max(255)).max(50).optional();
const images = z.array(z.string().url().max(2048)).max(100).optional();
const entityType = z.enum(ENTITY_TYPES);

export const create = kinoZodMutation({
  args: {
    systemId: zid('systems'),
    type: entityType,
    name: z.string().trim().min(1).max(255),
    aliases,
    summary: z.string().max(1000).nullable().optional(),
    attributes: rawAttributes,
    coverImageUrl: z.string().url().max(2048).nullable().optional(),
    images,
  },
  handler: async (ctx, input) => {
    const userId = ctx.user._id;
    const system = await ctx.db.get(input.systemId);
    if (!system || system.userId !== userId) forbidden('System does not belong to this user');
    const attrs = parseEntityAttributes(input.type, input.attributes);
    if (!attrs.success) forbidden('Invalid attributes for entity type');
    const now = Date.now();
    const id = await ctx.db.insert('entities', {
      userId,
      systemId: input.systemId,
      type: input.type,
      name: input.name,
      aliases: input.aliases ?? [],
      summary: input.summary ?? undefined,
      attributes: attrs.data ?? undefined,
      coverImageUrl: input.coverImageUrl ?? undefined,
      images: input.images ?? [],
      createdBy: userId,
      createdVia: 'session',
      createdAt: now,
      updatedAt: now,
    });
    // La entidad nueva puede aparecer ya en capítulos existentes.
    await recomputeSystemMentions(ctx, userId, input.systemId);
    return entityItem((await ctx.db.get(id))!);
  },
});

export const update = kinoZodMutation({
  args: {
    id: zid('entities'),
    type: entityType.optional(),
    name: z.string().trim().min(1).max(255).optional(),
    aliases,
    summary: z.string().max(1000).nullable().optional(),
    attributes: rawAttributes,
    coverImageUrl: z.string().url().max(2048).nullable().optional(),
    images,
  },
  handler: async (ctx, { id, ...input }) => {
    const existing = await ownEntity(ctx, ctx.user._id, id);
    const nextType = (input.type ?? existing.type) as EntityType;
    const patch: Partial<Doc<'entities'>> = { updatedAt: Date.now() };
    if (input.type !== undefined) patch.type = input.type;
    if (input.name !== undefined) patch.name = input.name;
    if (input.aliases !== undefined) patch.aliases = input.aliases;
    if (input.summary !== undefined) patch.summary = input.summary ?? undefined;
    if (input.coverImageUrl !== undefined) patch.coverImageUrl = input.coverImageUrl ?? undefined;
    if (input.images !== undefined) patch.images = input.images;
    if (input.attributes !== undefined || input.type !== undefined) {
      const attrs = parseEntityAttributes(nextType, input.attributes ?? undefined);
      if (!attrs.success) forbidden('Invalid attributes for entity type');
      if (input.attributes !== undefined) patch.attributes = attrs.data ?? undefined;
    }
    await ctx.db.patch(id, patch);
    if (input.name !== undefined || input.aliases !== undefined) {
      await recomputeSystemMentions(ctx, ctx.user._id, existing.systemId);
    }
    return entityItem((await ctx.db.get(id))!);
  },
});

/** Papelera: la entidad deja de contar y sus menciones se limpian. */
export const remove = kinoZodMutation({
  args: { id: zid('entities') },
  handler: async (ctx, { id }) => {
    await ownEntity(ctx, ctx.user._id, id);
    await ctx.db.patch(id, { deletedAt: Date.now() });
    for (const mention of await ctx.db.query('pageEntityMentions').withIndex('by_entity', (q) => q.eq('entityId', id)).collect()) {
      await ctx.db.delete(mention._id);
    }
    return null;
  },
});

export const createRelation = kinoZodMutation({
  args: {
    id: zid('entities'),
    toEntityId: zid('entities'),
    label: z.string().trim().max(100).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  },
  handler: async (ctx, { id, toEntityId, label, notes }) => {
    if (id === toEntityId) forbidden('An entity cannot relate to itself');
    await ownEntity(ctx, ctx.user._id, id);
    const other = await ownEntity(ctx, ctx.user._id, toEntityId);
    const relationId = await ctx.db.insert('entityRelations', {
      fromEntityId: id,
      toEntityId,
      label: label ?? undefined,
      notes: notes ?? undefined,
      createdAt: Date.now(),
    });
    return {
      id: relationId,
      label: label ?? null,
      notes: notes ?? null,
      other: { id: other._id, name: other.name, type: other.type },
      outgoing: true,
    };
  },
});

export const removeRelation = kinoZodMutation({
  args: { id: zid('entities'), relationId: zid('entityRelations') },
  handler: async (ctx, { relationId }) => {
    const rel = await ctx.db.get(relationId);
    if (!rel) return null;
    const owner = await ctx.db.get(rel.fromEntityId);
    if (!owner || owner.userId !== ctx.user._id) forbidden('Relation does not belong to this user');
    await ctx.db.delete(relationId);
    return null;
  },
});
