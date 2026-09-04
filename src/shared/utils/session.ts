import { cache } from 'react';
import { auth } from '@clerk/nextjs/server';

export interface ServerSession {
  clerkId: string;
  sessionId: string;
}

/**
 * La sesión de Clerk del request, resuelta una sola vez. Lo que Kino sabe de
 * esa persona vive en Convex (`users.current`); aquí sólo se decide si hay
 * alguien al otro lado.
 */
export const getServerSession = cache(async (): Promise<ServerSession | null> => {
  const { userId: clerkId, sessionId } = await auth();
  if (!clerkId || !sessionId) return null;
  return { clerkId, sessionId };
});
