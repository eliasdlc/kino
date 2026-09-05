'use node';

import { createClerkClient } from '@clerk/backend';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { kinoAction } from './lib/fn';
import { invalid } from './lib/errors';

// Borrar la cuenta entera. El orden importa: primero la identidad en Clerk,
// que cierra todas sus sesiones; después los documentos. Si Clerk falla no se
// ha tocado nada más y se puede reintentar.

export const remove = kinoAction(30_000)({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
    if (!ctx.user.clerkId) invalid('Esta cuenta no tiene identidad en Clerk');
    await clerk.users.deleteUser(ctx.user.clerkId);
    await ctx.runMutation(internal.users.purge, { userId: ctx.user._id });
    return null;
  },
});
