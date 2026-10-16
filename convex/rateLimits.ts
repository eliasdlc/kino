import { v } from 'convex/values';
import { kinoServicio } from './lib/fn';
import { RATE_LIMIT_SUBJECT } from './lib/mcpToken';

// El contador del rate limit que el proxy de Next consulta antes de dejar pasar
// una petición cara (`src/shared/rate-limit`). Vive aquí y no en la memoria de
// cada instancia para que todas las instancias cuenten sobre la misma fila y un
// arranque en frío no regale una cuota nueva. La política (cuánto, en qué
// ventana) se decide allí; esta función sólo suma.

/**
 * Más que cualquier ventana de la política: una fila cuya ventana empezó hace
 * más de esto ya no cuenta para nadie.
 */
const VIDA_DE_UNA_FILA_MS = 60 * 60 * 1000;

/**
 * Filas muertas que cada llamada borra de paso. Las identidades de sesión
 * cambian con cada renovación del token de Clerk, así que la tabla crece sola;
 * esto la acota sin un cron, que en el deployment de dev ni siquiera corre.
 */
const PODA_POR_LLAMADA = 8;

/**
 * Cuenta una petición de `identity` en `bucket` y devuelve el total de la
 * ventana que empieza en `windowStart`. Una fila por identidad y cubo: si la
 * ventana cambió, vuelve a 1 sobre la misma fila. Dos instancias que cuentan a
 * la vez chocan en esa fila y Convex reintenta una de las dos, así que ninguna
 * petición se pierde.
 */
export const hit = kinoServicio(RATE_LIMIT_SUBJECT)({
  args: { identity: v.string(), bucket: v.string(), windowStart: v.number() },
  returns: v.number(),
  handler: async (ctx, { identity, bucket, windowStart }) => {
    const fila = await ctx.db
      .query('rateLimits')
      .withIndex('by_identity_bucket', (q) => q.eq('identity', identity).eq('bucket', bucket))
      .unique();
    const hits = fila && fila.windowStart === windowStart ? fila.hits + 1 : 1;
    if (fila) await ctx.db.patch(fila._id, { windowStart, hits });
    else await ctx.db.insert('rateLimits', { identity, bucket, windowStart, hits });

    // El corte sale de la ventana que trae quien llama y no del reloj de aquí:
    // así la fila recién escrita nunca cae dentro.
    const muertas = await ctx.db
      .query('rateLimits')
      .withIndex('by_window', (q) => q.lt('windowStart', windowStart - VIDA_DE_UNA_FILA_MS))
      .take(PODA_POR_LLAMADA);
    for (const muerta of muertas) await ctx.db.delete(muerta._id);

    return hits;
  },
});
