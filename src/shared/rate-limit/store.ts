import { sql } from 'drizzle-orm';
import { db } from '@/shared/db';
import { rateLimits } from '@/shared/db/schema';

/**
 * El contador compartido. Se importa dinámicamente desde el proxy para que una
 * navegación de página no cargue drizzle ni abra conexión a Neon.
 */
export interface RateLimitStore {
  /** Cuenta esta request y devuelve el total acumulado en la ventana. */
  hit(identity: string, bucket: string, windowStart: Date): Promise<number>;
}

/**
 * Un solo statement, atómico: el `ON CONFLICT DO UPDATE` toma lock de la fila,
 * así que dos instancias serverless concurrentes se serializan y la segunda ve
 * el incremento de la primera. Eso es exactamente lo que el `Map` en memoria no
 * podía dar.
 *
 * El SQL no sabe nada de la política — sólo compara el `window_start` que le
 * pasan contra el que ya tenía la fila: si coinciden suma, si no, arranca de
 * nuevo en 1. El tamaño de ventana y el límite viven en `policy.ts`.
 */
export const postgresRateLimitStore: RateLimitStore = {
  async hit(identity, bucket, windowStart) {
    const [row] = await db
      .insert(rateLimits)
      .values({ identity, bucket, windowStart, hits: 1 })
      .onConflictDoUpdate({
        target: [rateLimits.identity, rateLimits.bucket],
        set: {
          hits: sql`case when ${rateLimits.windowStart} = excluded.window_start then ${rateLimits.hits} + 1 else 1 end`,
          windowStart: sql`excluded.window_start`,
        },
      })
      .returning({ hits: rateLimits.hits });

    return row.hits;
  },
};

/**
 * Poda las filas cuya ventana quedó atrás hace más de un día. La tabla no crece
 * con el tráfico (una fila por `identity` + `bucket`, reutilizada), pero las
 * cookies de sesión y los tokens OAuth rotan y dejan identidades huérfanas.
 * Va colgado del cron diario que ya existe para no gastar una entrada del free
 * tier de Vercel.
 */
export async function pruneStaleRateLimits(): Promise<number> {
  const deleted = await db
    .delete(rateLimits)
    .where(sql`${rateLimits.windowStart} < now() - interval '1 day'`)
    .returning({ identity: rateLimits.identity });

  return deleted.length;
}
