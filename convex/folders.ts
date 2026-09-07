import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { invalid, notFound } from './lib/errors';
import { kinoZodMutation, kinoZodQuery, type Channel } from './lib/fn';
import { color } from './schema';

// Las carpetas de un sistema. No hay `path`: el árbol se arma en memoria a
// partir de `parentId`, con una sola lectura por índice de todas las carpetas
// del usuario. Con cientos de carpetas eso son cientos de documentos pequeños,
// y ninguna función pregunta por descendientes de otra manera.

const COLORS = color.members.map((m) => m.value) as [string, ...string[]];

/** Lo que el cliente ve de una carpeta. `metadata` lo valida el arquetipo del sistema. */
const folderItem = (doc: Doc<'folders'>) => ({
  id: doc._id,
  name: doc.name,
  color: doc.color,
  sortIndex: doc.sortIndex,
  parentId: doc.parentId ?? null,
  systemId: doc.systemId ?? null,
  metadata: doc.metadata ?? null,
});
export type FolderItem = ReturnType<typeof folderItem>;

/** Carpetas vivas del usuario, en el orden en que se pintan. */
async function aliveFolders(ctx: QueryCtx, userId: Id<'users'>) {
  const docs = await ctx.db
    .query('folders')
    .withIndex('by_user_alive', (q) => q.eq('userId', userId).eq('deletedAt', undefined))
    .collect();
  return docs.sort((a, b) => a.sortIndex - b.sortIndex);
}

export type FolderNode = FolderItem & { children: FolderNode[] };

/** El árbol entero a partir de la lista plana. Las raíces son las sin padre. */
export function buildTree(folders: Doc<'folders'>[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>();
  for (const doc of folders) nodes.set(doc._id, { ...folderItem(doc), children: [] });
  const roots: FolderNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Ancestros de una carpeta, de la raíz al padre. */
export function ancestorsOf(folders: Doc<'folders'>[], folderId: Id<'folders'>): FolderItem[] {
  const byId = new Map(folders.map((doc) => [doc._id, doc]));
  const chain: FolderItem[] = [];
  let cursor = byId.get(folderId)?.parentId;
  while (cursor) {
    const parent = byId.get(cursor);
    if (!parent) break;
    chain.unshift(folderItem(parent));
    cursor = parent.parentId;
  }
  return chain;
}

/** Ids de una carpeta y de todo lo que cuelga de ella. */
export function subtreeIds(folders: Doc<'folders'>[], rootId: Id<'folders'>): Id<'folders'>[] {
  const childrenOf = new Map<string, Id<'folders'>[]>();
  for (const doc of folders) {
    if (doc.parentId) childrenOf.set(doc.parentId, [...(childrenOf.get(doc.parentId) ?? []), doc._id]);
  }
  const out: Id<'folders'>[] = [];
  const stack: Id<'folders'>[] = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(childrenOf.get(id) ?? []));
  }
  return out;
}

/** Cuántas subcarpetas y páginas vivas tiene una carpeta, para la tarjeta. */
async function withCounts(ctx: QueryCtx, all: Doc<'folders'>[], docs: Doc<'folders'>[]) {
  return Promise.all(
    docs.map(async (doc) => {
      const pages = await ctx.db
        .query('pages')
        .withIndex('by_folder', (q) => q.eq('folderId', doc._id))
        .collect();
      return {
        ...folderItem(doc),
        subfolderCount: all.filter((other) => other.parentId === doc._id).length,
        pageCount: pages.filter((page) => page.deletedAt === undefined).length,
      };
    }),
  );
}

async function ownFolder(ctx: QueryCtx, userId: Id<'users'>, id: Id<'folders'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId || doc.deletedAt !== undefined) notFound('Folder not found');
  return doc;
}

async function ownSystem(ctx: QueryCtx, userId: Id<'users'>, id: Id<'systems'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId || !doc.isActive) notFound('System not found');
  return doc;
}

// ── Lecturas ────────────────────────────────────────────────────────────────

/** El árbol completo del usuario, o el de un sistema. */
export const tree = kinoZodQuery({
  args: { systemId: zid('systems').optional() },
  handler: async (ctx, { systemId }) => {
    const all = await aliveFolders(ctx, ctx.user._id);
    return buildTree(systemId ? all.filter((doc) => doc.systemId === systemId) : all);
  },
});

/** Carpetas raíz de un sistema, con sus cuentas. */
export const bySystem = kinoZodQuery({
  args: { systemId: zid('systems') },
  handler: async (ctx, { systemId }) => {
    const all = await aliveFolders(ctx, ctx.user._id);
    const roots = all.filter((doc) => doc.systemId === systemId && doc.parentId === undefined);
    return withCounts(ctx, all, roots);
  },
});

/** Subcarpetas directas, con sus cuentas. */
export const children = kinoZodQuery({
  args: { id: zid('folders') },
  handler: async (ctx, { id }) => {
    await ownFolder(ctx, ctx.user._id, id);
    const all = await aliveFolders(ctx, ctx.user._id);
    return withCounts(ctx, all, all.filter((doc) => doc.parentId === id));
  },
});

/** Una carpeta con su rastro de migas. */
export const detail = kinoZodQuery({
  args: { id: zid('folders') },
  handler: async (ctx, { id }) => {
    const doc = await ownFolder(ctx, ctx.user._id, id);
    const all = await aliveFolders(ctx, ctx.user._id);
    return { ...folderItem(doc), breadcrumb: ancestorsOf(all, id) };
  },
});

// ── Escrituras ──────────────────────────────────────────────────────────────

const metadataField = z.record(z.string(), z.unknown()).nullish();

const createFields = {
  systemId: zid('systems'),
  name: z.string().min(1).max(255),
  color: z.enum(COLORS).optional(),
  parentId: zid('folders').optional(),
  metadata: metadataField,
};

/** Crea la carpeta. Exportada para la siembra del onboarding. */
export async function createFolderDoc(
  ctx: MutationCtx,
  userId: Id<'users'>,
  channel: Channel,
  args: z.infer<z.ZodObject<typeof createFields>>,
) {
  await ownSystem(ctx, userId, args.systemId);
  if (args.parentId) {
    const parent = await ownFolder(ctx, userId, args.parentId);
    if (parent.systemId !== args.systemId) invalid('Parent folder belongs to another system');
  }
  const now = Date.now();
  const id = await ctx.db.insert('folders', {
    userId,
    systemId: args.systemId,
    parentId: args.parentId,
    name: args.name,
    color: (args.color ?? 'blue') as Doc<'folders'>['color'],
    sortIndex: 0,
    metadata: args.metadata ?? undefined,
    createdBy: userId,
    createdVia: channel,
    createdAt: now,
    updatedAt: now,
  });
  return folderItem((await ctx.db.get(id))!);
}

export const create = kinoZodMutation({
  args: createFields,
  handler: async (ctx, args) => createFolderDoc(ctx, ctx.user._id, ctx.channel, args),
});

export const update = kinoZodMutation({
  args: {
    id: zid('folders'),
    name: z.string().min(1).max(255).optional(),
    color: z.enum(COLORS).optional(),
    metadata: metadataField,
  },
  handler: async (ctx, { id, ...data }) => {
    await ownFolder(ctx, ctx.user._id, id);
    await ctx.db.patch(id, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.color !== undefined ? { color: data.color as Doc<'folders'>['color'] } : {}),
      ...(data.metadata !== undefined ? { metadata: data.metadata ?? undefined } : {}),
      updatedAt: Date.now(),
    });
    return folderItem((await ctx.db.get(id))!);
  },
});

/**
 * Borra la carpeta y todo su subárbol. Lo que Postgres hacía por cascada va
 * aquí: las subcarpetas se marcan borradas, las notas adhesivas de cada una
 * también, y las tareas y páginas que estaban dentro se quedan sin carpeta
 * pero vivas. El borrado es blando: `deletedAt` puesto, documento intacto, y
 * toda lectura de carpetas y notas filtra por él.
 */
export const remove = kinoZodMutation({
  args: { id: zid('folders') },
  handler: async (ctx, { id }) => {
    await ownFolder(ctx, ctx.user._id, id);
    const all = await aliveFolders(ctx, ctx.user._id);
    for (const folderId of subtreeIds(all, id)) await removeOne(ctx, folderId);
    return null;
  },
});

async function removeOne(ctx: MutationCtx, folderId: Id<'folders'>) {
  const now = Date.now();
  for (const task of await ctx.db
    .query('tasks')
    .withIndex('by_folder_alive', (q) => q.eq('folderId', folderId))
    .collect()) {
    await ctx.db.patch(task._id, { folderId: undefined, updatedAt: now });
  }
  for (const page of await ctx.db
    .query('pages')
    .withIndex('by_folder', (q) => q.eq('folderId', folderId))
    .collect()) {
    await ctx.db.patch(page._id, { folderId: undefined, updatedAt: now });
  }
  for (const note of await ctx.db
    .query('stickyNotes')
    .withIndex('by_folder', (q) => q.eq('folderId', folderId))
    .collect()) {
    if (note.deletedAt === undefined) await ctx.db.patch(note._id, { deletedAt: now, updatedAt: now });
  }
  await ctx.db.patch(folderId, { deletedAt: now, updatedAt: now });
}
