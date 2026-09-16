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

// El universo de un sistema, ordenado por nombre. El índice fija el sistema y
// la papelera, así que la lectura no sale de ahí; el dueño se comprueba después
// porque el índice no lo lleva.
async function universeOf(ctx: Ctx, userId: Id<'users'>, systemId: Id<'systems'>) {
  const docs = await ctx.db
    .query('entities')
    .withIndex('by_system_alive', (q) => q.eq('systemId', systemId).eq('deletedAt', undefined))
    .collect();
  return docs.filter((doc) => doc.userId === userId).sort((a, b) => a.name.localeCompare(b.name));
}

// Las relaciones que tocan una entidad, por sus dos puntas: cada índice acota
// la lectura a ella, y el documento del otro extremo se pide uno a uno porque
// son los de esta entidad, no los del sistema.
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

// Los capítulos donde aparece una entidad. `by_entity` acota las menciones a
// ella, y son las de una ficha abierta: una entidad muy nombrada tiene tantas
// como capítulos la citen, no tantas como capítulos haya.
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
    // Las menciones de este capítulo y de ninguno más: el índice las fija por él.
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

/**
 * El grafo de un sistema. Vive fuera de la query para que `entities.test.ts`
 * pueda contar lo que abre: es la lectura más cara del codex y, como toda
 * suscripción, se relee entera en cada escritura que la toque.
 *
 * Abre tres consultas fijas y dos por entidad viva, **nunca una por capítulo**.
 * Los documentos que se lleva son los mismos por un camino y por el otro: lo
 * que cambia es el número de recorridos de índice y que dejan de encadenarse de
 * uno en uno, que es lo que un universo de cientos de capítulos pagaba contra
 * el presupuesto de 10 s de la restricción 4.
 */
export async function graphOf(ctx: Ctx, userId: Id<'users'>, systemId: Id<'systems'>): Promise<UniverseGraph> {
  {
    // Las entidades vivas del sistema: `by_system_alive` fija las dos cosas.
    const entities = await universeOf(ctx, userId, systemId);
    // Las obras son las carpetas del sistema, acotadas por `by_system`.
    const folders = (await ctx.db.query('folders').withIndex('by_system', (q) => q.eq('systemId', systemId)).collect())
      .filter((doc) => doc.userId === userId && doc.deletedAt === undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
    const works = folders.map((doc) => ({ id: doc._id, name: doc.name }));
    if (entities.length === 0) return { nodes: [], edges: [], works };

    const aliveIds = new Set<string>(entities.map((doc) => doc._id));
    const totals = new Map<string, number>();
    const worksByEntity = new Map<string, Set<string>>();
    // Los capítulos del sistema, por `by_system`. Además de decir en qué obra
    // cae cada mención, son el filtro: una mención a un capítulo que no esté
    // aquí (de otro sistema, o en la papelera) no cuenta.
    const pages = (await ctx.db.query('pages').withIndex('by_system', (q) => q.eq('systemId', systemId)).collect()).filter(
      (doc) => doc.userId === userId && doc.deletedAt === undefined,
    );
    // Una consulta de menciones por entidad viva (`by_entity`) en vez de una
    // por capítulo: el recuento es el mismo y la cuenta deja de crecer con el
    // texto escrito.
    const mentionsByPage = new Map<Id<'pages'>, Doc<'pageEntityMentions'>[]>();
    for (const mentions of await Promise.all(
      entities.map((entity) =>
        ctx.db.query('pageEntityMentions').withIndex('by_entity', (q) => q.eq('entityId', entity._id)).collect(),
      ),
    )) {
      for (const mention of mentions) {
        const rows = mentionsByPage.get(mention.pageId);
        if (rows) rows.push(mention);
        else mentionsByPage.set(mention.pageId, [mention]);
      }
    }
    // El recuento se recorre por capítulo aunque se leyera por entidad: las
    // obras de un nodo salen en el orden en que aparece en el sistema, y eso no
    // puede depender de por dónde se leyó.
    for (const page of pages) {
      for (const mention of mentionsByPage.get(page._id) ?? []) {
        totals.set(mention.entityId, (totals.get(mention.entityId) ?? 0) + mention.mentionCount);
        if (!page.folderId) continue;
        const set = worksByEntity.get(mention.entityId) ?? new Set<string>();
        set.add(page.folderId);
        worksByEntity.set(mention.entityId, set);
      }
    }
    // Una consulta de relaciones por entidad viva, desde su origen (`by_from`),
    // que ve cada arista una sola vez. `entityRelations` no tiene índice por
    // sistema, así que recorrer el universo es el rango más estrecho que hay.
    const relations = await Promise.all(
      entities.map((entity) =>
        ctx.db.query('entityRelations').withIndex('by_from', (q) => q.eq('fromEntityId', entity._id)).collect(),
      ),
    );
    const edges = [];
    for (const rel of relations.flat()) {
      if (aliveIds.has(rel.toEntityId)) edges.push({ id: rel._id, from: rel.fromEntityId, to: rel.toEntityId, label: rel.label ?? null });
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
  }
}

/** El universo listo para dibujar: nodos con su peso, aristas y las obras. */
export const graph = kinoZodQuery({
  args: { systemId: zid('systems') },
  handler: async (ctx, { systemId }): Promise<UniverseGraph> => graphOf(ctx, ctx.user._id, systemId),
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
      createdVia: ctx.channel,
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
    // Sólo sus menciones, por `by_entity`: son derivadas y se van con ella.
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

// ── La papelera ─────────────────────────────────────────────────────────────

/**
 * Entidades en la papelera, la más reciente primero.
 *
 * Su rango sólo fija el usuario, que es el caso que la restricción 9 marca como
 * deuda con nombre: enseñar la papelera cuesta leer el universo entero de la
 * cuenta, vivas incluidas, para quedarse con lo borrado. Acotarla pide un índice
 * que hoy no existe (`entities` no tiene ninguno por usuario y papelera), y eso
 * es un cambio de schema con su propio carril.
 */
export const trashed = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query('entities').withIndex('by_user', (q) => q.eq('userId', ctx.user._id)).collect();
    return docs
      .filter((doc) => !alive(doc))
      .sort((a, b) => b.deletedAt! - a.deletedAt!)
      .map((doc) => ({ ...entityItem(doc), deletedAt: iso(doc.deletedAt!) }));
  },
});

/**
 * Devuelve la entidad al universo de su sistema. Sus menciones se recalculan:
 * el borrado las destruyó porque son derivadas del texto, así que volver a
 * contarlas es parte de restaurar y no un efecto aparte.
 */
export const restore = kinoZodMutation({
  args: { id: zid('entities') },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== ctx.user._id || alive(doc)) notFound('Entity not found');
    await ctx.db.patch(id, { deletedAt: undefined, updatedAt: Date.now() });
    await recomputeSystemMentions(ctx, ctx.user._id, doc.systemId);
    return entityItem((await ctx.db.get(id))!);
  },
});
