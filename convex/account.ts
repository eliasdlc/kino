'use node';

import { createClerkClient } from '@clerk/backend';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { kinoAction } from './lib/fn';
import { invalid } from './lib/errors';

// Borrar la cuenta entera. El orden importa: primero la identidad en Clerk,
// que cierra todas sus sesiones; después los documentos. Si Clerk falla no se
// ha tocado nada más y se puede reintentar.
//
// Pide el correo de la cuenta, el que el diálogo de Ajustes hace escribir para
// confirmar, y lo compara aquí: la confirmación vale aunque la llamada no
// venga de esa pantalla.

/**
 * `closed`, y treinta segundos: borrar la cuenta no se deshace, así que ningún
 * alcance del conector la alcanza, y el presupuesto está por encima del
 * defecto porque son dos sistemas en cadena.
 */
export const remove = kinoAction(30_000, 'closed')({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, { email }): Promise<null> => {
    if (email.trim().toLowerCase() !== ctx.user.email.toLowerCase()) invalid('Ese no es el correo de esta cuenta');
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
    if (!ctx.user.clerkId) invalid('Esta cuenta no tiene identidad en Clerk');
    await clerk.users.deleteUser(ctx.user.clerkId);
    await ctx.runMutation(internal.users.purge, { userId: ctx.user._id });
    return null;
  },
});
