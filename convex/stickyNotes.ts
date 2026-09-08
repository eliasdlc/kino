import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { invalid, notFound } from './lib/errors';
import { diferencias, recordEvent } from './eventLog';
import { kinoZodMutation, kinoZodQuery, type Channel } from './lib/fn';
import { lematizar } from './lib/lemas';
import { color } from './schema';

// Notas adhesivas. Una nota cuelga de una página o de una carpeta, nunca de
// las dos, y por eso cada dueño tiene su par de funciones en vez de un
// `pageId` opcional que habría que comprobar a mano.

const COLORS = color.members.map((m) => m.value) as [string, ...string[]];
const POSITION_SIDES = ['left', 'right', 'over'] as const;

/** Lo que el cliente ve de una nota. */
export function noteItem(doc: Doc<'stickyNotes'>) {
  return {
    id: doc._id,
    title: doc.title ?? null,
    content: doc.content ?? null,
    color: doc.color,
    sortIndex: doc.sortIndex,
    pageId: doc.pageId ?? null,
    folderId: doc.folderId ?? null,
    positionSide: doc.positionSide ?? null,
    positionY: doc.positionY ?? null,
    positionX: doc.positionX ?? null,
    anchorId: doc.anchorId ?? null,
    stackId: doc.stackId ?? null,
    textAnchor: doc.textAnchor ?? null,
    isEureka: doc.isEureka,
  };
}
export type StickyNoteItem = ReturnType<typeof noteItem>;

const bySort = (a: Doc<'stickyNotes'>, b: Doc<'stickyNotes'>) => a.sortIndex - b.sortIndex;

async function ownNote(ctx: QueryCtx | MutationCtx, userId: Id<'users'>, id: Id<'stickyNotes'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId || doc.deletedAt !== undefined) notFound('Sticky note not found');
  return doc;
}

/**
 * Tope del ancla de texto de una nota, en caracteres.
 *
 * El ancla es el fragmento del texto al que la nota se pega, y entra al índice
 * de lemas de la búsqueda: sin tope, pegar una nota a un capítulo entero mete
 * el capítulo entero en el índice dos veces. Dos mil caracteres son varios
 * párrafos, que es más de lo que ancla nadie.
 *
 * **Sólo se comprueba al escribir.** Lo guardado por encima se lee igual, y
 * sigue entrando al índice como estaba.
 */
export const TEXT_ANCHOR_MAX = 2_000;

const textAnchor = z
  .string()
  .max(TEXT_ANCHOR_MAX, `El ancla pasa de ${TEXT_ANCHOR_MAX.toLocaleString('es')} caracteres. Ancla un párrafo, no el capítulo.`);

const noteFields = {
  title: z.string().max(200).optional(),
  content: z.string().max(500).optional(),
  color: z.enum(COLORS).optional(),
  textAnchor: textAnchor.nullable().optional(),
  positionSide: z.enum(POSITION_SIDES).nullable().optional(),
  positionY: z.number().min(0).max(1).nullable().optional(),
  // Fracción relativa a la columna de texto; negativa o mayor que 1 es el margen.
  positionX: z.number().min(-5).max(5).nullable().optional(),
  anchorId: z.string().nullable().optional(),
  clientRequestId: z.string().min(1).max(64).optional(),
};
type NoteFields = z.infer<z.ZodObject<typeof noteFields>>;

// ── Lecturas ────────────────────────────────────────────────────────────────

export const byPage = kinoZodQuery({
  args: { pageId: zid('pages') },
  handler: async (ctx, { pageId }) => {
    const docs = await ctx.db
      .query('stickyNotes')
      .withIndex('by_page', (q) => q.eq('pageId', pageId))
      .collect();
    return docs.filter((doc) => doc.userId === ctx.user._id && doc.deletedAt === undefined).sort(bySort).map(noteItem);
  },
});

export const byFolder = kinoZodQuery({
  args: { folderId: zid('folders') },
  handler: async (ctx, { folderId }) => {
    const docs = await ctx.db
      .query('stickyNotes')
      .withIndex('by_folder', (q) => q.eq('folderId', folderId))
      .collect();
    return docs.filter((doc) => doc.userId === ctx.user._id && doc.deletedAt === undefined).sort(bySort).map(noteItem);
  },
});

// ── Escrituras ──────────────────────────────────────────────────────────────

async function createOne(
  ctx: MutationCtx,
  userId: Id<'users'>,
  channel: Channel,
  owner: { pageId: Id<'pages'> } | { folderId: Id<'folders'> },
  data: NoteFields,
) {
  // Reintento de la cola offline: la misma petición devuelve la misma nota.
  if (data.clientRequestId) {
    const existing = await ctx.db
      .query('stickyNotes')
      .withIndex('by_user_clientRequest', (q) => q.eq('userId', userId).eq('clientRequestId', data.clientRequestId))
      .unique();
    if (existing) return noteItem(existing);
  }
  let systemId: Id<'systems'> | undefined;
  if ('pageId' in owner) {
    const page = await ctx.db.get(owner.pageId);
    if (!page || page.userId !== userId || page.deletedAt !== undefined) notFound('Page not found');
    systemId = page.systemId;
  } else {
    const folder = await ctx.db.get(owner.folderId);
    if (!folder || folder.userId !== userId || folder.deletedAt !== undefined) notFound('Folder not found');
    systemId = folder.systemId;
  }
  const now = Date.now();
  const id = await ctx.db.insert('stickyNotes', {
    userId,
    pageId: 'pageId' in owner ? owner.pageId : undefined,
    folderId: 'folderId' in owner ? owner.folderId : undefined,
    systemId,
    title: data.title,
    content: data.content,
    color: (data.color ?? 'yellow') as Doc<'stickyNotes'>['color'],
    sortIndex: 0,
    textAnchor: data.textAnchor ?? undefined,
    positionSide: data.positionSide ?? undefined,
    positionY: data.positionY ?? undefined,
    positionX: data.positionX ?? undefined,
    anchorId: data.anchorId ?? undefined,
    isEureka: false,
    clientRequestId: data.clientRequestId,
    lemas: lematizar(data.title, data.content, data.textAnchor),
    createdBy: userId,
    createdVia: channel,
    createdAt: now,
    updatedAt: now,
  });
  await recordEvent(ctx, {
    userId,
    systemId,
    actorChannel: channel,
    action: 'stickyNote.create',
    targetType: 'stickyNote',
    targetId: id,
    payload: { title: data.title ?? null },
  });
  return noteItem((await ctx.db.get(id))!);
}

export const createOnPage = kinoZodMutation({
  args: { ...noteFields, pageId: zid('pages') },
  handler: async (ctx, { pageId, ...data }) => createOne(ctx, ctx.user._id, ctx.channel, { pageId }, data),
});

export const createOnFolder = kinoZodMutation({
  args: { ...noteFields, folderId: zid('folders') },
  handler: async (ctx, { folderId, ...data }) => createOne(ctx, ctx.user._id, ctx.channel, { folderId }, data),
});

export const update = kinoZodMutation({
  args: {
    id: zid('stickyNotes'),
    title: z.string().max(200).nullable().optional(),
    content: z.string().max(500).nullable().optional(),
    color: z.enum(COLORS).optional(),
    positionSide: z.enum(POSITION_SIDES).nullable().optional(),
    positionY: z.number().min(0).max(1).nullable().optional(),
    positionX: z.number().min(-5).max(5).nullable().optional(),
    anchorId: z.string().nullable().optional(),
    stackId: z.string().nullable().optional(),
    textAnchor: textAnchor.nullable().optional(),
    isEureka: z.boolean().optional(),
  },
  handler: async (ctx, { id, ...data }) => {
    const current = await ownNote(ctx, ctx.user._id, id);
    const patch: Partial<Doc<'stickyNotes'>> = { updatedAt: Date.now() };
    if (data.title !== undefined) patch.title = data.title ?? undefined;
    if (data.content !== undefined) patch.content = data.content ?? undefined;
    if (data.color !== undefined) patch.color = data.color as Doc<'stickyNotes'>['color'];
    if (data.positionSide !== undefined) patch.positionSide = data.positionSide ?? undefined;
    if (data.positionY !== undefined) patch.positionY = data.positionY ?? undefined;
    if (data.positionX !== undefined) patch.positionX = data.positionX ?? undefined;
    if (data.anchorId !== undefined) patch.anchorId = data.anchorId ?? undefined;
    if (data.stackId !== undefined) patch.stackId = data.stackId ?? undefined;
    if (data.textAnchor !== undefined) patch.textAnchor = data.textAnchor ?? undefined;
    if (data.isEureka !== undefined) patch.isEureka = data.isEureka;
    if (data.title !== undefined || data.content !== undefined || data.textAnchor !== undefined) {
      patch.lemas = lematizar(
        data.title === undefined ? current.title : data.title,
        data.content === undefined ? current.content : data.content,
        data.textAnchor === undefined ? current.textAnchor : data.textAnchor,
      );
    }
    await ctx.db.patch(id, patch);
    const nota = (await ctx.db.get(id))!;
    await recordEvent(ctx, {
      userId: ctx.user._id,
      systemId: nota.systemId,
      actorChannel: ctx.channel,
      action: 'stickyNote.update',
      targetType: 'stickyNote',
      targetId: id,
      payload: diferencias(current, nota),
    });
    return noteItem(nota);
  },
});

/** Apila la arrastrada sobre la destino: comparten `stackId`, que es el id de la primera de la pila. */
export const stack = kinoZodMutation({
  args: { draggedId: zid('stickyNotes'), targetId: zid('stickyNotes') },
  handler: async (ctx, { draggedId, targetId }) => {
    const target = await ownNote(ctx, ctx.user._id, targetId);
    await ownNote(ctx, ctx.user._id, draggedId);
    const stackId = target.stackId ?? target._id;
    const now = Date.now();
    const dragged = await ctx.db.get(draggedId);
    await ctx.db.patch(draggedId, { stackId, updatedAt: now });
    if (!target.stackId) await ctx.db.patch(targetId, { stackId, updatedAt: now });
    // La nota que se arrastra es el objeto del gesto; la destino sólo estrena
    // `stackId` como consecuencia, y ésa es la cascada de éste.
    await recordEvent(ctx, {
      userId: ctx.user._id,
      systemId: target.systemId,
      actorChannel: ctx.channel,
      action: 'stickyNote.stack',
      targetType: 'stickyNote',
      targetId: draggedId,
      payload: { stackId: dragged?.stackId ?? null },
    });
    return {
      dragged: noteItem((await ctx.db.get(draggedId))!),
      target: noteItem((await ctx.db.get(targetId))!),
    };
  },
});

/** Borrado blando: la nota queda con `deletedAt` y desaparece de toda lectura. */
export const remove = kinoZodMutation({
  args: { id: zid('stickyNotes') },
  handler: async (ctx, { id }) => {
    const nota = await ownNote(ctx, ctx.user._id, id);
    await ctx.db.patch(id, { deletedAt: Date.now(), updatedAt: Date.now() });
    await recordEvent(ctx, {
      userId: ctx.user._id,
      systemId: nota.systemId,
      actorChannel: ctx.channel,
      action: 'stickyNote.remove',
      targetType: 'stickyNote',
      targetId: id,
      payload: { title: nota.title ?? null },
    });
    return null;
  },
});

// ── La papelera ─────────────────────────────────────────────────────────────

/** Si el dueño de la nota está vivo. Una nota que se fue con su capítulo o su carpeta vuelve con él, no sola. */
async function ownerAlive(ctx: QueryCtx | MutationCtx, doc: Doc<'stickyNotes'>) {
  const owner = doc.pageId ? await ctx.db.get(doc.pageId) : doc.folderId ? await ctx.db.get(doc.folderId) : null;
  return owner !== null && owner.deletedAt === undefined;
}

/**
 * Notas en la papelera. Sólo las que se borraron solas: la que cayó con su
 * cuaderno o su capítulo no se lista, porque restaurarla dejaría una nota
 * pegada a algo que sigue borrado.
 */
export const trashed = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query('stickyNotes')
      .withIndex('by_user_alive', (q) => q.eq('userId', ctx.user._id))
      .collect();
    const out = [];
    for (const doc of docs.filter((d) => d.deletedAt !== undefined).sort((a, b) => b.deletedAt! - a.deletedAt!)) {
      if (await ownerAlive(ctx, doc)) out.push({ ...noteItem(doc), deletedAt: new Date(doc.deletedAt!).toISOString() });
    }
    return out;
  },
});

/** Devuelve la nota a su margen. Con el dueño borrado no hay margen al que volver. */
export const restore = kinoZodMutation({
  args: { id: zid('stickyNotes') },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id);
    if (!doc || doc.userId !== ctx.user._id || doc.deletedAt === undefined) notFound('Sticky note not found');
    if (!(await ownerAlive(ctx, doc))) invalid('Restaura antes el cuaderno o el capítulo donde estaba');
    await ctx.db.patch(id, { deletedAt: undefined, updatedAt: Date.now() });
    await recordEvent(ctx, {
      userId: ctx.user._id,
      systemId: doc.systemId,
      actorChannel: ctx.channel,
      action: 'stickyNote.restore',
      targetType: 'stickyNote',
      targetId: id,
      payload: { title: doc.title ?? null },
    });
    return noteItem((await ctx.db.get(id))!);
  },
});
