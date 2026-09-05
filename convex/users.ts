import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';
import schema from './schema';
import { kinoMutation, kinoQuery } from './lib/fn';

// La identidad de Clerk llega en el JWT; el documento `users` es lo que Kino
// sabe de esa persona. El envoltorio de `lib/fn` es quien los une.

/** El documento `users` de quien llama. */
export const current = kinoQuery({
  args: {},
  handler: async (ctx) => ctx.user,
});

/**
 * Garantiza que la identidad tiene su documento y lo devuelve. El cliente lo
 * llama al entrar; las queries que vienen detrás ya lo encuentran.
 */
export const ensure = kinoMutation({
  args: {},
  returns: v.id('users'),
  handler: async (ctx) => ctx.user._id,
});

/** Para las acciones, que no tienen base a mano y lo piden por aquí. */
export const byClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) =>
    ctx.db
      .query('users')
      .withIndex('by_clerkId', (q) => q.eq('clerkId', clerkId))
      .unique(),
});

/** Borra todo documento de cualquier tabla que pertenezca al usuario, y al final el usuario. */
export const purge = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    for (const table of Object.keys(schema.tables) as (keyof typeof schema.tables)[]) {
      if (table === 'users') continue;
      const docs = await ctx.db
        .query(table)
        .filter((q) => q.eq(q.field('userId'), userId))
        .collect();
      for (const doc of docs) await ctx.db.delete(doc._id);
    }
    await ctx.db.delete(userId);
  },
});
