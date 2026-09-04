import { ConvexError, v } from 'convex/values';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';

// La identidad de Clerk llega en el JWT; el documento `users` es lo que Kino
// sabe de esa persona. Estas dos funciones son la única puerta entre ambos.

/** El documento `users` de quien llama, o null sin sesión ni documento. */
export const current = query({
  args: {},
  handler: async (ctx): Promise<Doc<'users'> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return findByClerkId(ctx, identity.subject);
  },
});

/**
 * Garantiza que la identidad de Clerk tiene su documento, y lo devuelve.
 * Un usuario importado de Postgres existe por correo pero sin `clerkId`: la
 * primera sesión lo enlaza en vez de duplicarlo. Volver a llamar no crea nada.
 */
export const ensure = mutation({
  args: {},
  returns: v.id('users'),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED' });

    const linked = await findByClerkId(ctx, identity.subject);
    if (linked) return linked._id;

    const email = identity.email;
    if (!email) throw new ConvexError({ code: 'EMAIL_REQUIRED' });
    const now = Date.now();

    const imported = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();
    if (imported) {
      await ctx.db.patch(imported._id, { clerkId: identity.subject, updatedAt: now });
      return imported._id;
    }

    return ctx.db.insert('users', {
      clerkId: identity.subject,
      email,
      name: identity.name ?? email.split('@')[0],
      image: identity.pictureUrl,
      onboardingCompleted: false,
      status: 'active',
      timezone: 'America/Santo_Domingo',
      createdAt: now,
      updatedAt: now,
    });
  },
});

function findByClerkId(ctx: QueryCtx | MutationCtx, clerkId: string) {
  return ctx.db
    .query('users')
    .withIndex('by_clerkId', (q) => q.eq('clerkId', clerkId))
    .unique();
}
