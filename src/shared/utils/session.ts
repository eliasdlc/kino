import { cache } from 'react';
import { auth } from '@clerk/nextjs/server';
import { api } from '@convex/_generated/api';
import { serverMutation } from '@/shared/convex/server';

export interface ServerSession {
  clerkId: string;
  sessionId: string;
}

/**
 * La sesión de Clerk del request, resuelta una sola vez. Lo que Kino sabe de
 * esa persona vive en Convex (`users.current`); aquí se decide si hay alguien
 * al otro lado y se garantiza que su documento existe antes de que layout y
 * página, que Next renderiza en paralelo, lo lean.
 */
export const getServerSession = cache(async (): Promise<ServerSession | null> => {
  const { userId: clerkId, sessionId } = await auth();
  if (!clerkId || !sessionId) return null;
  await serverMutation(api.users.ensure, {});
  return { clerkId, sessionId };
});
