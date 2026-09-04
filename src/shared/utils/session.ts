import { cache } from 'react';
import { auth } from '@clerk/nextjs/server';
import { linkClerkUser, type LinkedUser } from './clerk-user';

export interface ServerSession {
  user: LinkedUser;
  session: { id: string };
  clerkId: string;
}

/**
 * La sesión del request, resuelta una sola vez.
 *
 * Clerk valida la cookie sin ir a la red; lo que sí cuesta una consulta es
 * traducir su identidad al usuario de Kino, y un layout y la página que
 * renderiza dentro la pedían por separado.
 *
 * `cache()` de React memoiza **por request**, no entre peticiones: dos
 * peticiones distintas nunca comparten resultado, así que esto no puede servir
 * la sesión de otro usuario ni sobrevivir a un cierre de sesión.
 */
export const getServerSession = cache(async (): Promise<ServerSession | null> => {
  const { userId: clerkId, sessionId } = await auth();
  if (!clerkId || !sessionId) return null;
  const user = await linkClerkUser(clerkId);
  return { user, session: { id: sessionId }, clerkId };
});
