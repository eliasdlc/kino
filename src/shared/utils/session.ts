import { cache } from 'react';
import { auth } from '@clerk/nextjs/server';
import { api } from '@convex/_generated/api';
import { serverMutation } from '@/shared/convex/server';

export interface ServerSession {
  clerkId: string;
  sessionId: string;
}

/**
 * La sesión de Clerk del request, resuelta una sola vez. Lo que hay guardado
 * de esa persona vive en Convex (`users.current`); aquí se decide si hay alguien
 * al otro lado y se garantiza que su documento existe antes de que layout y
 * página, que Next renderiza en paralelo, lo lean.
 *
 * **Exigir `sessionId` y no sólo `clerkId` es la barrera, no una comprobación
 * de más.** Una ruta que vive fuera de Convex no pasa por el envoltorio de
 * `convex/lib/fn.ts`, así que nadie mira su `kino_scope`: sin esta línea, un
 * token del conector MCP con alcance `read` resolvería identidad y llegaría
 * tan lejos como el navegador. Un token OAuth de Clerk trae `userId` y nunca
 * `sessionId`, y ahí se corta.
 */
export const getServerSession = cache(async (): Promise<ServerSession | null> => {
  const { userId: clerkId, sessionId } = await auth();
  if (!clerkId || !sessionId) return null;
  await serverMutation(api.users.ensure, {});
  return { clerkId, sessionId };
});
