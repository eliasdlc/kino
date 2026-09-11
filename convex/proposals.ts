import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import { invalid, notFound } from './lib/errors';
import { kinoZodMutation, kinoZodProposal, kinoZodQuery } from './lib/fn';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { removePageDoc, updatePageDoc } from './pages';
import { removeTaskDoc } from './tasks';

// Una propuesta es una escritura que el usuario todavía no ha aceptado. Aquí
// sólo vive el tope y quién la crea; quién las lista y las aplica llega en la
// fase que le da pantalla.
//
// ── Retención ──────────────────────────────────────────────────────────────
// Catorce días desde que se crea (`expiresAt`). Una propuesta caducada no se
// borra sola: cambia a `expired` cuando alguien la mira, porque el usuario
// tiene derecho a ver qué se le propuso y se le pasó. Quien la dispara es la
// pantalla de propuestas, no un cron.

/** Días que una propuesta pendiente sigue siendo aplicable. */
export const EXPIRES_IN_DAYS = 14;

/**
 * Propuestas pendientes que un usuario puede acumular. El tope existe porque
 * un agente en bucle podría llenar la bandeja hasta hacerla inservible: veinte
 * es lo que cabe en una pantalla sin que el usuario deje de leerlas.
 */
export const MAX_PENDING = 20;

/**
 * Bytes del cuerpo que una propuesta de reescritura puede llevar.
 *
 * El texto propuesto tiene que viajar entero (media reescritura no es una
 * propuesta), pero veinte pendientes de medio megabyte serían diez megabytes
 * por persona esperando una decisión. Con este tope son 1,3 MB en el peor caso,
 * y sesenta y cuatro mil caracteres son unas diez mil palabras: un capítulo
 * largo entra. Lo que no entra recibe un error que lo dice.
 */
export const REWRITE_MAX_BYTES = 64 * 1024;

/** Cuántas pendientes tiene ahora mismo. */
export async function pendingCount(ctx: MutationCtx, userId: Id<'users'>): Promise<number> {
  const rows = await ctx.db
    .query('proposals')
    .withIndex('by_user_status', (q) => q.eq('userId', userId).eq('status', 'pending'))
    .collect();
  return rows.length;
}

/**
 * Las dos razones por las que un agente propone en vez de escribir.
 *
 * `archive` sigue en el schema y no se puede pedir: archivar no existe en Kino
 * (D-09, 8 de septiembre, en la misma dirección que D3), así que una propuesta
 * de archivar no tendría nada que aplicar. El literal se queda en la tabla
 * porque quitarlo cuesta un turno de schema y no estorba; lo que importa es que
 * no se pueda escribir.
 *
 *  * `cancel`: mandar algo a la papelera. Es la única vía por la que un borrado
 *    puede salir del agente, ahora que ninguna tool borra: lo propone y decides.
 *  * `rewrite`: sustituir el cuerpo de un capítulo. Reescribir lo que escribiste
 *    es suplantar tu voz, y eso se propone.
 */
export const PROPOSAL_KINDS = ['cancel', 'rewrite'] as const;

/** Lo que una propuesta puede señalar hoy. */
export const CANCELABLES = ['task', 'page'] as const;
export type Cancelable = (typeof CANCELABLES)[number];

/**
 * Crea una propuesta. Es `kinoZodProposal` y no `kinoZodMutation` a propósito:
 * un agente con alcance `propose` llega hasta aquí y no más allá.
 *
 * **El origen no es un argumento.** `sourceClientId` sale del token que la ruta
 * firmó con lo que Clerk verificó: si el agente pudiera declararlo, podría
 * firmar sus propuestas con el nombre de otro cliente y «descartar todas las de
 * este origen» dejaría de ser una salida y pasaría a ser una trampa.
 *
 * **La evidencia se comprueba al crearla y al leerla.** Aquí, para que el
 * agente sepa en el acto que señaló algo que no existe; y al listarla, porque
 * entre proponer y decidir pasan hasta catorce días.
 */
export const create = kinoZodProposal({
  args: {
    kind: z.enum(PROPOSAL_KINDS),
    evidenceType: z.enum(CANCELABLES),
    evidenceId: z.string().min(1).max(64),
    /** Sólo en `rewrite`: el cuerpo propuesto, en HTML como lo guarda la página. */
    contenido: z.string().optional(),
    motivo: z.string().max(500).optional(),
  },
  handler: async (ctx, input) => {
    const userId = ctx.user._id;
    if ((await pendingCount(ctx, userId)) >= MAX_PENDING) {
      invalid(
        `Ya hay ${MAX_PENDING} propuestas pendientes y ésa es la cola entera. La persona tiene que resolver alguna, o descartar de golpe las de tu origen, antes de que quepa otra.`,
      );
    }

    const fila = await evidenciaViva(ctx, userId, input.evidenceType, input.evidenceId);
    if (!fila) notFound('Eso que señalas como evidencia no existe o no es de esta cuenta.');

    if (input.kind === 'rewrite') {
      if (input.evidenceType !== 'page') invalid('Sólo se reescribe el cuerpo de un capítulo.');
      if (input.contenido === undefined) invalid('Una propuesta de reescritura sin el texto propuesto no se puede aplicar.');
      const bytes = new TextEncoder().encode(input.contenido).byteLength;
      if (bytes > REWRITE_MAX_BYTES) {
        invalid(`El texto propuesto pasa de ${REWRITE_MAX_BYTES} bytes. Propón el capítulo por partes o pídeselo a la persona.`);
      }
    }

    const now = Date.now();
    const id = await ctx.db.insert('proposals', {
      userId,
      systemId: fila.systemId ?? undefined,
      status: 'pending',
      kind: input.kind,
      sourceClientId: ctx.clientId,
      evidenceType: input.evidenceType,
      evidenceId: input.evidenceId,
      payload: {
        ...(input.contenido === undefined ? {} : { contenido: input.contenido }),
        ...(input.motivo === undefined ? {} : { motivo: input.motivo }),
      },
      expiresAt: now + EXPIRES_IN_DAYS * 86_400_000,
      createdAt: now,
    });
    return { id, expiresAt: new Date(now + EXPIRES_IN_DAYS * 86_400_000).toISOString() };
  },
});

// ── La evidencia ────────────────────────────────────────────────────────────

/**
 * La fila que respalda una propuesta, si sigue viva y es de esta cuenta.
 *
 * **La evidencia es una referencia que el servidor resuelve, no un texto que el
 * agente escribe.** Un agente que redacta su propia justificación puede
 * afirmar cualquier cosa; una referencia o existe o no existe. Si no existe, la
 * propuesta no se pinta, porque una propuesta sobre algo que ya no está no
 * describe la realidad.
 */
export async function evidenciaViva(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  tipo: (typeof CANCELABLES)[number],
  id: string,
): Promise<{ titulo: string | null; systemId: Id<'systems'> | null } | null> {
  if (tipo === 'task') {
    const doc = await ctx.db.get(id as Id<'tasks'>);
    if (!doc || doc.userId !== userId || doc.deletedAt !== undefined) return null;
    return { titulo: doc.title, systemId: doc.systemId };
  }
  const doc = await ctx.db.get(id as Id<'pages'>);
  if (!doc || doc.userId !== userId || doc.deletedAt !== undefined) return null;
  return { titulo: doc.title ?? null, systemId: doc.systemId ?? null };
}

/** Una propuesta que ya pasó su fecha. Caduca al mirarla, no por cron. */
export const caducada = (fila: Doc<'proposals'>, now: number) => fila.status === 'pending' && fila.expiresAt <= now;

// ── Leer, aplicar, descartar ────────────────────────────────────────────────

/**
 * Las propuestas que esperan una decisión, la más vieja primero.
 *
 * Caducar ocurre aquí y no en un cron a propósito: una propuesta caducada no se
 * borra, cambia de estado cuando alguien la mira, porque tienes derecho a ver
 * qué se te propuso y se te pasó.
 */
export const pendientes = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const filas = await ctx.db
      .query('proposals')
      .withIndex('by_user_status', (q) => q.eq('userId', ctx.user._id).eq('status', 'pending'))
      .collect();

    const now = Date.now();
    const items = [];
    for (const fila of filas.sort((a, b) => a.createdAt - b.createdAt)) {
      const evidencia = await evidenciaViva(ctx, ctx.user._id, fila.evidenceType as (typeof CANCELABLES)[number], fila.evidenceId);
      // Sin la fila que la justifica no se pinta, y el test lo demuestra
      // borrándola: una propuesta que ya no describe nada es peor que ninguna.
      if (!evidencia) continue;
      items.push({
        id: fila._id,
        kind: fila.kind,
        origen: fila.sourceClientId ?? null,
        evidencia: { tipo: fila.evidenceType, id: fila.evidenceId, titulo: evidencia.titulo },
        motivo: (fila.payload.motivo as string | undefined) ?? null,
        caducada: caducada(fila, now),
        creada: new Date(fila.createdAt).toISOString(),
        caduca: new Date(fila.expiresAt).toISOString(),
      });
    }
    return items;
  },
});

/** Marca como caducadas las que ya pasaron su fecha. La dispara quien mira. */
export const caducar = kinoZodMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const filas = await ctx.db
      .query('proposals')
      .withIndex('by_user_status', (q) => q.eq('userId', ctx.user._id).eq('status', 'pending'))
      .collect();
    let cuantas = 0;
    for (const fila of filas) {
      if (!caducada(fila, now)) continue;
      await ctx.db.patch(fila._id, { status: 'expired', resolvedAt: now });
      cuantas += 1;
    }
    return { cuantas };
  },
});

/** La propuesta de esta cuenta, o el error de por qué no se puede tocar. */
async function pendienteDe(ctx: MutationCtx, userId: Id<'users'>, id: Id<'proposals'>) {
  const fila = await ctx.db.get(id);
  if (!fila || fila.userId !== userId) notFound('Esa propuesta no existe.');
  return fila;
}

/**
 * Acepta una propuesta. La escritura la hace la misma función que la haría a
 * mano, así que deja su evento y su deshacer sin nada especial: el evento lleva
 * además el `proposalId`, que es lo que hace que la fila del log diga que
 * aquello salió de una propuesta y no de un impulso.
 *
 * **Una propuesta caducada no se aplica.** Aceptar hoy un «cancela estas doce»
 * de hace tres semanas borraría cosas que volviste a tocar.
 */
export const aplicar = kinoZodMutation({
  args: { id: zid('proposals') },
  handler: async (ctx, { id }) => {
    const fila = await pendienteDe(ctx, ctx.user._id, id);
    const now = Date.now();

    if (fila.status !== 'pending') return { aplicada: false as const, motivo: 'Esa propuesta ya se resolvió.' };
    if (caducada(fila, now)) {
      await ctx.db.patch(fila._id, { status: 'expired', resolvedAt: now });
      return { aplicada: false as const, motivo: 'Esa propuesta caducó: describía cómo estaban las cosas hace más de dos semanas.' };
    }

    const tipo = fila.evidenceType as (typeof CANCELABLES)[number];
    if (!(await evidenciaViva(ctx, ctx.user._id, tipo, fila.evidenceId))) {
      return { aplicada: false as const, motivo: 'Lo que la propuesta señalaba ya no está.' };
    }

    if (fila.kind === 'cancel') {
      if (tipo === 'task') await removeTaskDoc(ctx, ctx.user._id, ctx.channel, fila.evidenceId as Id<'tasks'>, fila._id);
      else await removePageDoc(ctx, ctx.user._id, ctx.channel, fila.evidenceId as Id<'pages'>, fila._id);
    } else {
      // La reescritura pasa por la misma edición que haría el navegador, así
      // que archiva la versión anterior y deja su evento: el deshacer de la
      // propuesta aceptada es el deshacer de siempre, sin nada especial.
      await updatePageDoc(
        ctx,
        ctx.user._id,
        ctx.channel,
        fila.evidenceId as Id<'pages'>,
        { content: fila.payload.contenido as string },
        fila._id,
      );
    }

    await ctx.db.patch(fila._id, { status: 'applied', resolvedAt: now });
    return { aplicada: true as const };
  },
});

/** Descarta una propuesta. No vuelve: `dismissed` es terminal. */
export const descartar = kinoZodMutation({
  args: { id: zid('proposals') },
  handler: async (ctx, { id }) => {
    const fila = await pendienteDe(ctx, ctx.user._id, id);
    if (fila.status !== 'pending') return { descartada: false as const };
    await ctx.db.patch(fila._id, { status: 'dismissed', resolvedAt: Date.now() });
    return { descartada: true as const };
  },
});

/**
 * Descarta de golpe todas las pendientes de un origen.
 *
 * **Es la salida del candado.** El techo de veinte existe para que un agente en
 * bucle no haga la bandeja inservible, pero sin esta puerta el techo lo cierra
 * igual: veinte pendientes dejan a la persona sin recibir ninguna más hasta que
 * resuelva veinte a mano. Con esto, un origen que se desmadró se limpia entero
 * y las de los demás se quedan.
 */
export const descartarOrigen = kinoZodMutation({
  args: { origen: z.string().min(1).max(255) },
  handler: async (ctx, { origen }) => {
    const filas = await ctx.db
      .query('proposals')
      .withIndex('by_user_status', (q) => q.eq('userId', ctx.user._id).eq('status', 'pending'))
      .collect();
    const now = Date.now();
    let cuantas = 0;
    for (const fila of filas) {
      if (fila.sourceClientId !== origen) continue;
      await ctx.db.patch(fila._id, { status: 'dismissed', resolvedAt: now });
      cuantas += 1;
    }
    return { cuantas };
  },
});
