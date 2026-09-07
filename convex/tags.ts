import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { forbidden, notFound } from './lib/errors';
import { kinoZodMutation, kinoZodQuery } from './lib/fn';
import { color } from './schema';
import { recordEvent } from './eventLog';

// Etiquetas de contexto. Sin `systemId` es global del usuario; con él, del sistema.

const COLORS = color.members.map((m) => m.value) as [string, ...string[]];

export function tagItem(doc: Doc<'contextTags'>) {
  return {
    id: doc._id,
    title: doc.title,
    color: doc.color,
    systemId: doc.systemId ?? null,
    isDefault: doc.isDefault,
  };
}
export type TagItem = ReturnType<typeof tagItem>;

async function ownTag(ctx: QueryCtx | MutationCtx, userId: Id<'users'>, id: Id<'contextTags'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId) notFound('Tag not found');
  return doc;
}

/** Las etiquetas que un sistema puede usar: las suyas y las globales. */
export const bySystem = kinoZodQuery({
  args: { systemId: zid('systems') },
  handler: async (ctx, { systemId }) => {
    const docs = await ctx.db
      .query('contextTags')
      .withIndex('by_user', (q) => q.eq('userId', ctx.user._id))
      .collect();
    return docs
      .filter((doc) => doc.systemId === undefined || doc.systemId === systemId)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(tagItem);
  },
});

export const create = kinoZodMutation({
  args: {
    title: z.string().min(1).max(24),
    color: z.enum(COLORS).optional(),
    systemId: zid('systems').nullable().optional(),
  },
  handler: async (ctx, input) => {
    if (input.systemId) {
      const system = await ctx.db.get(input.systemId);
      if (!system || system.userId !== ctx.user._id) notFound('System not found');
    }
    const id = await ctx.db.insert('contextTags', {
      userId: ctx.user._id,
      systemId: input.systemId ?? undefined,
      title: input.title,
      color: (input.color ?? 'blue') as Doc<'contextTags'>['color'],
      isDefault: false,
      createdAt: Date.now(),
    });
    return tagItem((await ctx.db.get(id))!);
  },
});

export const update = kinoZodMutation({
  args: { id: zid('contextTags'), title: z.string().min(1).max(24).optional(), color: z.enum(COLORS).optional() },
  handler: async (ctx, { id, ...data }) => {
    await ownTag(ctx, ctx.user._id, id);
    await ctx.db.patch(id, {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.color !== undefined ? { color: data.color as Doc<'contextTags'>['color'] } : {}),
    });
    return tagItem((await ctx.db.get(id))!);
  },
});

/** Borra la etiqueta y la quita de las tareas y páginas que la llevaban. */
/**
 * Borra la etiqueta. Es la única cascada del rework que destruye de verdad, y
 * por eso es la más estricta:
 *
 *   - Sólo el dueño del sistema al que pertenece la etiqueta la borra. Un
 *     miembro invitado no le quita a los demás una etiqueta que están usando.
 *   - Desetiqueta únicamente las tareas dentro del alcance del actor: las suyas
 *     del sistema de la etiqueta, o todas las suyas si la etiqueta es global.
 *   - Deja una fila en `eventLog`, que es lo único que queda de ella.
 *
 *   tasks.contextTagId  set null → se desetiqueta.
 *   pageTags.tagId      cascade  → el par no significa nada sin la etiqueta.
 */
export const remove = kinoZodMutation({
  args: { id: zid('contextTags') },
  handler: async (ctx, { id }) => {
    const userId = ctx.user._id;
    const tag = await ownTag(ctx, userId, id);
    if (tag.systemId) {
      const system = await ctx.db.get(tag.systemId);
      if (!system || system.userId !== userId) forbidden('Sólo el dueño del sistema borra sus etiquetas');
    }
    const now = Date.now();
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_user_alive_status', (q) => q.eq('userId', userId))
      .collect();
    let desetiquetadas = 0;
    for (const task of tasks) {
      if (task.contextTagId !== id) continue;
      // El alcance del actor: una etiqueta de sistema no toca tareas de otro.
      if (tag.systemId && task.systemId !== tag.systemId) continue;
      await ctx.db.patch(task._id, { contextTagId: undefined, updatedAt: now });
      desetiquetadas += 1;
    }
    let enlaces = 0;
    for (const link of await ctx.db.query('pageTags').withIndex('by_tag', (q) => q.eq('tagId', id)).collect()) {
      await ctx.db.delete(link._id);
      enlaces += 1;
    }
    await ctx.db.delete(id);
    await recordEvent(ctx, {
      userId,
      systemId: tag.systemId,
      actorChannel: ctx.channel,
      action: 'tag.remove',
      targetType: 'tag',
      targetId: id,
      payload: { title: tag.title, color: tag.color, desetiquetadas, enlaces },
    });
    return null;
  },
});
