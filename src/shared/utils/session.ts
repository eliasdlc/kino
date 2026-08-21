import { cache } from 'react';
import { headers } from 'next/headers';
import { auth } from '@/auth';

/**
 * La sesión del request, resuelta una sola vez.
 *
 * Las sesiones son stateful en Postgres, así que cada `auth.api.getSession` es
 * una consulta real. Un layout y la página que renderiza dentro la pedían por
 * separado, o sea dos consultas por navegación para el mismo dato.
 *
 * `cache()` de React memoiza **por request**, no entre peticiones: dos
 * peticiones distintas nunca comparten resultado, así que esto no puede servir
 * la sesión de otro usuario ni sobrevivir a un cierre de sesión. No es un
 * caché entre peticiones y no debe usarse como tal.
 */
export const getServerSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});
