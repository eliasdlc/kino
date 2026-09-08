import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalMutation, type MutationCtx, type QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { kinoQuery } from './lib/fn';
import { itemType, type ActorChannel } from './schema';

// El registro de lo que el usuario pidió que se escribiera. Sostiene el log de
// actividad, el deshacer y las aristas automáticas.
//
// ── El invariante ──────────────────────────────────────────────────────────
// Está escrito aquí y en ningún otro sitio, porque `recordEvent` es el único
// escritor y no hay dónde más ponerlo:
//
//   **Una fila del log es una acción que alguien pidió, y nunca una escritura
//   derivada de otra acción ya registrada.**
//
// La coletilla no es una rendija, es la forma exacta del invariante. Sin ella
// contradice al propio schema: `sync` y `system` son canales del actor, así
// que hay escrituras que nadie pidió a mano (la sincronización con GitHub, la
// siguiente ocurrencia de una serie recurrente) y ésas sí dejan fila, porque
// no hay ninguna otra que las cuente. Lo que no deja fila es la cascada de un
// borrado, el `syncAutoReminders` de una edición o el rollover del plan de
// hoy: consecuencias de algo que ya está en el log, y una fila por cada una
// convertiría el log en un rastro de la implementación en vez de un rastro de
// lo que la persona hizo.
//
// Cada llamada a `recordEvent` es una de las primeras; cada sitio que decide
// no llamarla escribe al lado de cuál acción registrada lo cubre.
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

/**
 * Campos que toda escritura toca y que nunca son un cambio que alguien pidió,
 * así que no entran en el diff de una edición: revertirlos a mano sería
 * revertir dos veces lo mismo. `lemas` es derivado del título y del cuerpo, y
 * vuelve solo en cuanto uno de los dos vuelve.
 */
const DERIVADOS = new Set(['updatedAt', 'lemas']);

/**
 * En qué se diferencian dos versiones de un documento, con el valor que el
 * campo tenía **antes**.
 *
 * Es el payload de toda edición, y la forma la decide el deshacer campo a
 * campo: para revertir hacen falta los valores anteriores de exactamente los
 * campos que cambiaron, ni uno más. Un campo que se reescribe con el mismo
 * valor no entra, porque deshacerlo no devolvería nada.
 *
 * Recorre la unión de las dos versiones y no sólo la nueva: un campo que la
 * edición borró desaparece del documento, y ése es justo el que más falta hace
 * para deshacer. `null` significa que no había valor.
 */
export function diferencias<T extends object>(antes: T, despues: T): Record<string, unknown> {
  const cambios: Record<string, unknown> = {};
  for (const campo of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    if (campo.startsWith('_') || DERIVADOS.has(campo)) continue;
    const previo = (antes as Record<string, unknown>)[campo];
    if (previo === (despues as Record<string, unknown>)[campo]) continue;
    cambios[campo] = previo ?? null;
  }
  return cambios;
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
  /** La propuesta que el usuario aceptó, cuando la escritura viene de una. */
  proposalId?: Id<'proposals'>;
  /**
   * La versión anterior del capítulo, cuando el cuerpo cambió. Es lo que evita
   * meter veinte mil caracteres dentro de un payload acotado a 2.048 bytes: el
   * deshacer de una edición de cuaderno restaura desde aquí, no desde el diff.
   */
  snapshotId?: Id<'pageSnapshots'>;
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
    proposalId: input.proposalId,
    snapshotId: input.snapshotId,
    occurredAt: Date.now(),
  });
}

// ── Quién aparece en una fila ───────────────────────────────────────────────

/**
 * El actor de un evento, tal como el lector lo puede ver.
 *
 * Son **dos variantes y no un objeto con el nombre opcional**: la redactada no
 * tiene campo de nombre, así que una lectura que no debe enseñarlo no puede
 * construir un objeto que lo lleve aunque el autor del código se despiste. La
 * regla de quién ve qué hizo quién dentro de un sistema compartido la sostiene
 * el compilador, que es de lo que se trataba.
 *
 * El canal sobrevive a la redacción a propósito: saber que algo lo escribió un
 * agente y no una persona es la mitad del valor del log, y no dice quién.
 */
export type Actor =
  | { readonly kind: 'propio'; readonly channel: ActorChannel; readonly name: string }
  | { readonly kind: 'redactado'; readonly channel: ActorChannel };

/**
 * El actor de un evento para un lector concreto. Sólo se nombra al lector: el
 * nombre de otra persona no se redacta después de leerlo, no se lee nunca.
 */
export function actorDe(evento: Doc<'eventLog'>, lector: Doc<'users'>): Actor {
  if (evento.actorId === lector._id) return { kind: 'propio', channel: evento.actorChannel, name: lector.name };
  return { kind: 'redactado', channel: evento.actorChannel };
}

// ── La lectura por item ─────────────────────────────────────────────────────

/**
 * Tope de eventos por respuesta. Treinta días de retención sobre un item que
 * alguien edita a diario caben de sobra en cien, y `restantes` lo dice cuando
 * no: es el mismo trato que `TASK_LIST_LIMIT`.
 */
export const EVENT_LIST_LIMIT = 100;

/** Si el lector alcanza el sistema de un evento ajeno, por membresía. */
async function alcanzaSistema(ctx: QueryCtx, userId: Id<'users'>, systemId: Id<'systems'> | undefined) {
  if (!systemId) return false;
  const membresia = await ctx.db
    .query('systemMembers')
    .withIndex('by_system_user', (q) => q.eq('systemId', systemId).eq('userId', userId))
    .unique();
  return membresia !== null;
}

/**
 * Lo que le ha pasado a un item: quién, por qué vía y cuándo, lo más reciente
 * primero.
 *
 * Es la lista **por item**, la que se abre desde el propio item. La fila diaria
 * de lo que hizo tu agente es otra cosa y vive en Hoy.
 */
export const porItem = kinoQuery({
  args: { targetType: itemType, targetId: v.string() },
  handler: async (ctx, { targetType, targetId }) => {
    const filas = await ctx.db
      .query('eventLog')
      .withIndex('by_target', (q) => q.eq('targetType', targetType).eq('targetId', targetId))
      .order('desc')
      .collect();

    const visibles: Doc<'eventLog'>[] = [];
    for (const fila of filas) {
      if (fila.userId === ctx.user._id || (await alcanzaSistema(ctx, ctx.user._id, fila.systemId))) visibles.push(fila);
    }

    return {
      items: visibles.slice(0, EVENT_LIST_LIMIT).map((fila) => ({
        id: fila._id,
        action: fila.action,
        actor: actorDe(fila, ctx.user),
        occurredAt: new Date(fila.occurredAt).toISOString(),
        undoneAt: fila.undoneAt === undefined ? null : new Date(fila.undoneAt).toISOString(),
        undoneFields: fila.undoneFields ?? null,
        // Que la escritura salió de una propuesta que el usuario aceptó, sin
        // exponer la propuesta: el item no es sitio para abrirla.
        desdePropuesta: fila.proposalId !== undefined,
      })),
      restantes: Math.max(0, visibles.length - EVENT_LIST_LIMIT),
    };
  },
});

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
