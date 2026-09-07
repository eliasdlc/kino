import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, type MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { ActorChannel } from './schema';

// El registro de lo que el usuario pidió que se escribiera. Sostiene el log de
// actividad, el deshacer y las aristas automáticas. Aquí sólo vive la poda y
// el escritor; quién lo lee llega en fases posteriores.
//
// ── Retención ──────────────────────────────────────────────────────────────
// Treinta días. La dispara el cron `event-log-prune`, cada día a las 12:20
// UTC, veinte minutos después del snapshot diario para no competir con él.
// La poda va por lotes con tope: borra hasta PRUNE_BATCH filas por ejecución y
// se reprograma sola mientras queden, de modo que una tabla con millones de
// filas se vacía en muchas mutaciones cortas y ninguna se acerca al límite de
// tiempo de Convex.

/** Días que sobrevive un evento. */
export const RETENTION_DAYS = 30;

/**
 * Filas por ejecución. Medido sobre `by_occurred`, que devuelve las más viejas
 * primero: mil borrados es un orden de magnitud por debajo del límite de una
 * mutación, así que el lote entra holgado dentro de los diez segundos.
 */
export const PRUNE_BATCH = 1_000;

/** Bytes máximos del diff que un evento guarda. Lo que pase se descarta. */
export const PAYLOAD_MAX_BYTES = 2_048;

/**
 * Recorta el diff al tope del contrato. Un payload que se pasa no se trunca a
 * medias (dejaría un objeto ilegible): se sustituye por la marca de que hubo
 * más, y el evento sigue sirviendo para el log aunque no para el deshacer.
 */
export function boundPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  if (encoded.byteLength <= PAYLOAD_MAX_BYTES) return payload;
  return { omitido: true, bytes: encoded.byteLength };
}

/** Lo que un evento necesita saber de quien lo provocó. */
export type EventInput = {
  userId: Id<'users'>;
  actorId?: Id<'users'>;
  actorChannel: ActorChannel;
  systemId?: Id<'systems'>;
  clientId?: string;
  action: string;
  targetType: Doc<'eventLog'>['targetType'];
  targetId: string;
  payload?: Record<string, unknown>;
};

/**
 * Deja una fila en el log. Es el único escritor: todo lo que quiera registrar
 * algo pasa por aquí, para que el recorte del payload no dependa del llamante.
 */
export async function recordEvent(ctx: MutationCtx, input: EventInput): Promise<Id<'eventLog'>> {
  return ctx.db.insert('eventLog', {
    userId: input.userId,
    systemId: input.systemId,
    actorId: input.actorId ?? input.userId,
    actorChannel: input.actorChannel,
    clientId: input.clientId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    payload: boundPayload(input.payload ?? {}),
    occurredAt: Date.now(),
  });
}

/**
 * Borra los eventos de más de treinta días, hasta PRUNE_BATCH por ejecución.
 * Si llenó el lote quedan más viejos, y se reprograma para seguir; si no, ha
 * terminado. Reejecutarla sobre una tabla ya podada no borra nada.
 */
export const podar = internalMutation({
  args: { limite: v.optional(v.number()) },
  handler: async (ctx, { limite }) => {
    const tope = limite ?? PRUNE_BATCH;
    const corte = Date.now() - RETENTION_DAYS * 86_400_000;
    const viejos = await ctx.db
      .query('eventLog')
      .withIndex('by_occurred', (q) => q.lt('occurredAt', corte))
      .take(tope);
    for (const doc of viejos) await ctx.db.delete(doc._id);

    const quedan = viejos.length === tope;
    if (quedan) await ctx.scheduler.runAfter(0, internal.eventLog.podar, { limite: tope });
    return { borradas: viejos.length, quedan };
  },
});
