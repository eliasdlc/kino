import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { podarCapturas } from './captures';
import { podarEventos } from './eventLog';

/**
 * La única entrada de cron de las podas.
 *
 * Existe porque el presupuesto de diez segundos es **de la entrada** y no de
 * cada poda por su lado: cuatro podas de diez segundos no caben en una función
 * de diez. Medirlas juntas es la única forma de que el número signifique algo,
 * y tenerlas en una sola entrada es lo que obliga a medirlas juntas.
 *
 * Cada poda va por lotes y se reprograma sola si quedó trabajo, así que una
 * ejecución larga no bloquea a la siguiente.
 */
export const diaria = internalMutation({
  args: { limite: v.optional(v.number()) },
  handler: async (ctx, { limite }) => {
    const eventos = await podarEventos(ctx, limite);
    const capturas = await podarCapturas(ctx, limite);
    return { eventos, capturas };
  },
});
