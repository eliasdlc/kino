import { cache } from 'react';
import { auth } from '@clerk/nextjs/server';

export interface ServerSession {
  clerkId: string;
  sessionId: string;
}

/**
 * La sesión de Clerk del request, resuelta una sola vez. Lo que hay guardado
 * de esa persona vive en Convex (`users.current`); aquí sólo se decide si hay
 * alguien al otro lado.
 *
 * **No escribe nada, y eso es la mitad del contrato.** Esto corre en cada
 * render de cada página, así que cualquier escritura que se ponga aquí es una
 * escritura por página y un salto en serie antes de la primera lectura. Quien
 * garantiza que la fila de `users` existe son dos cosas que corren antes de
 * llegar aquí: el webhook `user.created` de Clerk (`convex/http.ts`) en el
 * caso normal, y `src/proxy.ts` como suelo, una vez por navegador, para la
 * ventana en la que el navegador llega antes que el webhook.
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
  return { clerkId, sessionId };
});
