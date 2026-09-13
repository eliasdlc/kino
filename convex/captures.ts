import { z } from 'zod';
import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { invalid, notFound } from './lib/errors';
import { kinoZodMutation, kinoZodQuery } from './lib/fn';
import { recordEvent } from './eventLog';
import { createTaskDoc } from './tasks';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

/**
 * Lo que se comparte desde fuera, entre que llega y que se confirma.
 *
 * Dos reglas sostienen el slice entero y ninguna es negociable:
 *
 *  1. **Nada se convierte en item sin un gesto.** Una captura no es una tarea:
 *     es material en bruto de quien la mandó, y hasta que alguien confirma no
 *     existe nada en ningún sistema.
 *  2. **Nunca se archiva en silencio.** Una captura sin confirmar caduca, pero
 *     se avisa una semana antes y la caducada sigue viéndose otra semana más:
 *     desaparecer sin decirlo es lo único que esta tabla no puede hacer.
 *
 * ── Retención ──────────────────────────────────────────────────────────────
 * Treinta días desde que llega (`expiresAt`), avisando a los veintitrés. Es la
 * misma ventana que la poda de `eventLog`, así que el producto tiene un solo
 * número de retención y no dos. La poda comparte la única entrada de cron con
 * las demás y su presupuesto de diez segundos se mide sumado, no por separado.
 */

/** Días que una captura sin confirmar sigue viva. */
export const RETENCION_DIAS = 30;

/** Con esto o menos por delante, la fila lo dice. El aviso va antes, siempre. */
export const AVISO_DIAS = 7;

/** Lo que una captura caducada sigue viéndose antes de irse de verdad. */
export const GRACIA_DIAS = 7;

/** Cuántas filas toca una poda por ejecución. */
export const PRUNE_BATCH = 500;

const DIA_MS = 86_400_000;

/** Cuántos días le quedan, redondeando hacia arriba: «medio día» no se dice. */
export function diasRestantes(expiresAt: number, ahora: number): number {
  return Math.max(0, Math.ceil((expiresAt - ahora) / DIA_MS));
}

/** Si toca decir que esto se va a ir. El aviso nunca llega después. */
export function tocaAvisar(expiresAt: number, ahora: number): boolean {
  const quedan = diasRestantes(expiresAt, ahora);
  return quedan > 0 && quedan <= AVISO_DIAS;
}

/** Lo que el agente devuelve por cada cosa que leyó en la captura. */
const itemPropuesto = z.object({
  title: z.string().min(1).max(500),
  /** A dónde propone mandarlo. Sin esto, va a Bandeja. */
  systemId: z.string().optional(),
  notes: z.string().max(2_000).optional(),
});

export type ItemPropuesto = z.infer<typeof itemPropuesto>;

/** La captura tal como la lee la pantalla. */
function capturaItem(fila: Doc<'captures'>, ahora: number) {
  return {
    id: fila._id,
    kind: fila.kind,
    status: fila.status,
    text: fila.text ?? null,
    url: fila.url ?? null,
    blobPath: fila.blobPath ?? null,
    durationSeconds: fila.durationSeconds ?? null,
    proposedItems: (fila.proposedItems ?? null) as ItemPropuesto[] | null,
    createdAt: fila.createdAt,
    expiresAt: fila.expiresAt,
    diasRestantes: diasRestantes(fila.expiresAt, ahora),
    avisa: tocaAvisar(fila.expiresAt, ahora),
  };
}

/** La captura de quien pregunta, o nada. Una captura no cruza de cuenta. */
async function propia(ctx: QueryCtx | MutationCtx, userId: Id<'users'>, id: Id<'captures'>) {
  const fila = await ctx.db.get(id);
  if (!fila || fila.userId !== userId) notFound('Esa captura no existe');
  return fila;
}

/**
 * Lo que Bandeja enseña: lo que espera confirmación y lo que ya caducó pero
 * todavía se puede ver. Lo confirmado y lo descartado no vuelven.
 */
export const pendientes = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const ahora = Date.now();
    const sinConfirmar = await ctx.db
      .query('captures')
      .withIndex('by_user_status', (q) => q.eq('userId', ctx.user._id).eq('status', 'pending'))
      .collect();
    const caducadas = await ctx.db
      .query('captures')
      .withIndex('by_user_status', (q) => q.eq('userId', ctx.user._id).eq('status', 'expired'))
      .collect();

    return [...sinConfirmar, ...caducadas]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((fila) => capturaItem(fila, ahora));
  },
});

/**
 * Crea una captura. La llama la pantalla de compartir cuando hay red, con lo
 * que el service worker ya dejó guardado en el teléfono.
 */
export const crear = kinoZodMutation({
  args: {
    kind: z.enum(['voice', 'photo', 'link', 'text']),
    text: z.string().max(10_000).optional(),
    url: z.string().url().max(2_000).optional(),
    /** Dónde quedó el archivo subido, cuando lo hay. */
    blobPath: z.string().max(500).optional(),
    durationSeconds: z.number().int().min(0).max(86_400).optional(),
  },
  handler: async (ctx, input) => {
    if (input.kind === 'link' && !input.url) invalid('Un enlace compartido llega con su dirección');
    if (input.kind === 'text' && !input.text) invalid('Un texto compartido llega con su texto');

    const ahora = Date.now();
    const id = await ctx.db.insert('captures', {
      userId: ctx.user._id,
      status: 'pending',
      kind: input.kind,
      blobPath: input.blobPath,
      durationSeconds: input.durationSeconds,
      text: input.text,
      url: input.url,
      expiresAt: ahora + RETENCION_DIAS * DIA_MS,
      createdAt: ahora,
    });

    await recordEvent(ctx, {
      userId: ctx.user._id,
      actorChannel: ctx.channel,
      action: 'capture.create',
      targetType: 'capture',
      targetId: id,
      payload: { kind: input.kind },
    });

    return capturaItem((await ctx.db.get(id))!, ahora);
  },
});

/**
 * Convierte en tareas los items que el agente propuso y que la persona marcó.
 * Es el gesto: sin él nada de lo compartido existe en ningún sistema.
 */
export const confirmar = kinoZodMutation({
  args: {
    id: z.string().min(1),
    /** Los índices de `proposedItems` que se confirman. */
    indices: z.array(z.number().int().min(0)).min(1),
  },
  handler: async (ctx, { id, indices }) => {
    const captura = await propia(ctx, ctx.user._id, id as Id<'captures'>);
    if (captura.status !== 'pending') invalid('Esa captura ya no espera confirmación');

    const propuestos = (captura.proposedItems ?? []) as ItemPropuesto[];
    if (propuestos.length === 0) invalid('Todavía no hay nada propuesto para esta captura');

    const inbox = await ctx.db
      .query('systems')
      .withIndex('by_user_inbox', (q) => q.eq('userId', ctx.user._id).eq('isInbox', true))
      .first();
    if (!inbox) notFound('No hay Bandeja donde dejar esto');

    const creadas: Id<'tasks'>[] = [];
    for (const indice of [...new Set(indices)].sort((a, b) => a - b)) {
      const item = propuestos[indice];
      if (!item) invalid('Ese item no estaba entre los propuestos');
      const tarea = await createTaskDoc(ctx, ctx.user._id, ctx.channel, ctx.user.timezone ?? 'UTC', {
        systemId: (item.systemId as Id<'systems'> | undefined) ?? inbox._id,
        title: item.title,
        description: item.notes,
      });
      creadas.push(tarea._id);
    }

    await ctx.db.patch(captura._id, { status: 'confirmed', resolvedAt: Date.now() });
    await recordEvent(ctx, {
      userId: ctx.user._id,
      actorChannel: ctx.channel,
      action: 'capture.confirm',
      targetType: 'capture',
      targetId: captura._id,
      payload: { creadas: creadas.length },
    });

    return { creadas: creadas.length };
  },
});

/** La persona decide que esto no era nada. Se va, pero porque lo dijo. */
export const descartar = kinoZodMutation({
  args: { id: z.string().min(1) },
  handler: async (ctx, { id }) => {
    const captura = await propia(ctx, ctx.user._id, id as Id<'captures'>);
    if (captura.status === 'confirmed') invalid('Esa captura ya se confirmó');

    const anterior = captura.status;
    await ctx.db.patch(captura._id, { status: 'discarded', resolvedAt: Date.now() });
    await recordEvent(ctx, {
      userId: ctx.user._id,
      actorChannel: ctx.channel,
      action: 'capture.discard',
      targetType: 'capture',
      targetId: captura._id,
      // El estado **anterior**, que es lo que el deshacer por campos restaura.
      // Descartar es la única de las cuatro acciones de una captura que una
      // persona decide y puede querer revertir.
      payload: { status: anterior },
    });
    return { ok: true };
  },
});

/**
 * La poda, en dos pasos y ninguno silencioso: lo que pasó de su fecha cambia a
 * `expired` y **se sigue viendo**, y sólo lo que lleva la semana de gracia
 * caducado se borra de verdad. Reejecutarla sobre una tabla ya podada no borra
 * nada.
 *
 * No es una `internalMutation` suelta: la llama la única entrada de cron, junto
 * a las demás podas, porque los diez segundos son de la entrada y no de cada
 * una por separado.
 */
export async function podarCapturas(ctx: MutationCtx, tope = PRUNE_BATCH) {
  const ahora = Date.now();

  const vencidas = await ctx.db
    .query('captures')
    .withIndex('by_expires', (q) => q.lt('expiresAt', ahora))
    .take(tope);

  let caducadas = 0;
  let borradas = 0;

  for (const fila of vencidas) {
    if (fila.status === 'pending') {
      await ctx.db.patch(fila._id, { status: 'expired' });
      await recordEvent(ctx, {
        userId: fila.userId,
        actorChannel: 'system',
        action: 'capture.expire',
        targetType: 'capture',
        targetId: fila._id,
        payload: { kind: fila.kind },
      });
      caducadas += 1;
      continue;
    }
    // Confirmada, descartada o caducada hace más de la semana de gracia: ya
    // nadie la espera y su fila del log guarda lo que pasó.
    if (fila.expiresAt < ahora - GRACIA_DIAS * DIA_MS) {
      await ctx.db.delete(fila._id);
      borradas += 1;
    }
  }

  return { caducadas, borradas, quedan: vencidas.length === tope };
}

/** La misma poda, invocable a mano cuando hay que medirla sola. */
export const podar = internalMutation({
  args: { limite: v.optional(v.number()) },
  handler: async (ctx, { limite }) => podarCapturas(ctx, limite ?? PRUNE_BATCH),
});
