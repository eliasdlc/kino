import { z } from 'zod';
import { ConvexError, v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { captureKind } from './schema';
import { proveedor } from '../src/features/connections/providers';
import { invalid, notFound } from './lib/errors';
import { kinoZodMutation, kinoZodProposal, kinoZodQuery } from './lib/fn';
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
    source: fila.source ?? null,
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
      // Lo que entró por una fuente conectada lleva su nombre en la tarea: es
      // lo que permite contar cuántas tareas nacieron sin que nadie las tecleara.
      if (captura.source) {
        await ctx.db.patch(tarea._id, { externalSource: captura.source, externalId: `${captura._id}:${indice}` });
      }
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

/**
 * Le entrega la captura al agente en un formato que puede mirar.
 *
 * **Los ojos los pone el agente, no Kino.** Aquí no hay análisis: hay una
 * entrega. La captura sale con su tipo y con la ruta de su archivo, y quien la
 * mira lo hace con su propia clave y en su propio contexto. Kino no manda un
 * byte a ningún modelo, y hay un grep en la verificación que lo comprueba.
 */
export const entregar = kinoZodQuery({
  args: { id: z.string().min(1) },
  handler: async (ctx, { id }) => {
    const captura = await propia(ctx, ctx.user._id, id as Id<'captures'>);
    if (captura.status !== 'pending') invalid('Esa captura ya no espera a nadie');

    return {
      id: captura._id,
      kind: captura.kind,
      source: captura.source ?? null,
      text: captura.text ?? null,
      url: captura.url ?? null,
      /** La ruta del archivo. El agente la abre con su clave, no Kino por él. */
      blobPath: captura.blobPath ?? null,
      durationSeconds: captura.durationSeconds ?? null,
      resuelta: captura.proposedItems !== undefined,
    };
  },
});

/**
 * Recibe los items tipados que el agente leyó en la captura. No crea tareas:
 * las deja propuestas dentro de la captura, que sigue sin confirmar en Bandeja.
 * El gesto lo da una persona, siempre.
 *
 * Es `kinoZodProposal` y no una mutación directa a propósito: una credencial de
 * agente desatendido lee y propone, nunca escribe (D-07).
 *
 * Idempotente por captura: resolver dos veces devuelve conflicto y no duplica
 * nada, porque un agente que reintenta es lo normal y duplicar la lista de
 * items sería el peor sitio donde notarlo.
 */
export const resolver = kinoZodProposal({
  args: {
    id: z.string().min(1),
    items: z.array(itemPropuesto).min(1).max(50),
  },
  handler: async (ctx, { id, items }) => {
    const captura = await propia(ctx, ctx.user._id, id as Id<'captures'>);
    if (captura.status !== 'pending') invalid('Esa captura ya no espera a nadie');
    if (captura.proposedItems !== undefined) {
      throw new ConvexError({
        code: 'CONFLICT' as const,
        message: 'Esa captura ya la leyó alguien. Vuelve a pedirla con la tool de entrega antes de proponer.',
      });
    }

    await ctx.db.patch(captura._id, { proposedItems: items });
    await recordEvent(ctx, {
      userId: ctx.user._id,
      actorChannel: ctx.channel,
      action: 'capture.resolve',
      targetType: 'capture',
      targetId: captura._id,
      payload: { items: items.length },
    });

    return { propuestos: items.length };
  },
});

/** Cuántas capturas pendientes devuelve una página de `porFuente` como mucho. */
export const PAGINA_FUENTE = 50;

/**
 * Lo que espera a un agente, por fuente y con cursor. Es la lectura con la que
 * un agente vacía la cola sin pedir Bandeja entera: lee una página, la entrega
 * con `get_capture`, propone con `resolve_capture` y pide la siguiente.
 *
 * Lee por índice hasta el tamaño de la página y para: sin fuente, las
 * pendientes de la cuenta; con fuente, sólo las de esa fuente. Las más nuevas
 * primero.
 */
export const porFuente = kinoZodQuery({
  args: {
    source: z.string().min(1).max(50).optional(),
    cursor: z.string().nullable().optional(),
    limite: z.number().int().min(1).max(PAGINA_FUENTE).optional(),
  },
  handler: async (ctx, { source, cursor, limite }) => {
    const userId = ctx.user._id;
    const consulta =
      source === undefined
        ? ctx.db.query('captures').withIndex('by_user_status', (q) => q.eq('userId', userId).eq('status', 'pending'))
        : ctx.db
            .query('captures')
            .withIndex('by_user_status_source', (q) =>
              q.eq('userId', userId).eq('status', 'pending').eq('source', source),
            );
    const pagina = await consulta.order('desc').paginate({ cursor: cursor ?? null, numItems: limite ?? 25 });
    return {
      items: pagina.page.map((fila) => ({
        id: fila._id,
        kind: fila.kind,
        source: fila.source ?? null,
        text: fila.text ?? null,
        url: fila.url ?? null,
        createdAt: fila.createdAt,
        resuelta: fila.proposedItems !== undefined,
      })),
      cursor: pagina.isDone ? null : pagina.continueCursor,
    };
  },
});

/**
 * La puerta de entrada de una fuente conectada (el correo, Drive, lo que
 * venga). **Una fuente entrega capturas, nunca tareas**: lo que llega espera en
 * Bandeja a que una persona, o su agente con propuesta y confirmación, decida
 * qué se vuelve tarea. Las dos excepciones que escriben tareas directo (el aula
 * virtual y GitHub) están en AGENTS.md y en el registro de proveedores, y no
 * pasan por aquí.
 *
 * La fuente tiene que estar en el registro y declarar que entrega capturas; una
 * fuente desconocida se rechaza en vez de inventarse.
 *
 * Idempotente por (persona, fuente, id externo): un refresco repetido no
 * duplica. Si la captura sigue pendiente, toma lo último que la fuente dijo; si
 * ya se confirmó, se descartó o caducó, no se toca ni se resucita.
 */
export async function ingerirCaptura(
  ctx: MutationCtx,
  entrada: {
    userId: Id<'users'>;
    source: string;
    externalId: string;
    kind: Doc<'captures'>['kind'];
    text?: string;
    url?: string;
    blobPath?: string;
  },
): Promise<{ id: Id<'captures'>; creada: boolean }> {
  const registro = proveedor(entrada.source);
  if (!registro || registro.entrega !== 'captura') {
    invalid(`La fuente ${entrada.source} no está en el registro de proveedores que entregan capturas`);
  }

  const existente = await ctx.db
    .query('captures')
    .withIndex('by_user_source_external', (q) =>
      q.eq('userId', entrada.userId).eq('source', entrada.source).eq('externalId', entrada.externalId),
    )
    .first();
  if (existente) {
    if (existente.status === 'pending') {
      // Sólo lo que la fuente volvió a mandar: un campo ausente en el refresco no
      // borra el que ya estaba, porque `patch` quita lo que llega en `undefined`.
      const cambios = Object.fromEntries(
        Object.entries({ text: entrada.text, url: entrada.url, blobPath: entrada.blobPath }).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(cambios).length > 0) await ctx.db.patch(existente._id, cambios);
    }
    return { id: existente._id, creada: false };
  }

  const ahora = Date.now();
  const id = await ctx.db.insert('captures', {
    userId: entrada.userId,
    status: 'pending',
    kind: entrada.kind,
    source: entrada.source,
    externalId: entrada.externalId,
    text: entrada.text,
    url: entrada.url,
    blobPath: entrada.blobPath,
    expiresAt: ahora + RETENCION_DIAS * DIA_MS,
    createdAt: ahora,
  });
  await recordEvent(ctx, {
    userId: entrada.userId,
    actorChannel: 'sync',
    action: 'capture.create',
    targetType: 'capture',
    targetId: id,
    payload: { kind: entrada.kind, source: entrada.source },
  });
  return { id, creada: true };
}

/** La misma entrada, para la ruta HTTP o la acción que reciba cada fuente. */
export const ingerir = internalMutation({
  args: {
    userId: v.id('users'),
    source: v.string(),
    externalId: v.string(),
    kind: captureKind,
    text: v.optional(v.string()),
    url: v.optional(v.string()),
    blobPath: v.optional(v.string()),
  },
  handler: (ctx, entrada) => ingerirCaptura(ctx, entrada),
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
