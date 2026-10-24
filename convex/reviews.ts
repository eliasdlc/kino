import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { forbidden, invalid, notFound } from './lib/errors';
import { recordEvent } from './eventLog';
import { kinoZodMutation, kinoZodProposal, kinoZodQuery, type Caller, type Channel } from './lib/fn';
import {
  AFFIX_MAX,
  BODY_MAX,
  CLOSED_SHOWN,
  HINT_MAX,
  MAX_COMMENTS_PER_REVIEW,
  MAX_OPEN_PER_PAGE,
  MAX_REPLIES,
  QUOTE_MAX,
  REVIEWER_MAX,
  REVIEWS_SHOWN,
  SUGGESTION_MAX,
  SUMMARY_MAX,
  reviewProgress,
} from './lib/reviews';
import { htmlToPlainText, locateQuote, type QuoteMatch } from '../src/shared/lib/text-quote';
import { reviewCategory, reviewSeverity, type ActorChannel, type CommentTurn, type ReviewCategory, type ReviewSeverity } from './schema';

// La revisión de un documento: el agente de la persona lee la página por el
// conector, deja comentarios anclados a fragmentos y la persona los cierra uno
// a uno mientras una barra se llena. Kino no lee el texto con ningún modelo:
// guarda lo que el agente escribió, comprueba que lo que cita existe y mide.
//
// Comentar es proponer (`proposed`): un comentario no toca el texto de nadie y
// espera a que la persona decida qué hace con él, así que un agente con alcance
// `propose` revisa igual que uno con `write`. Dar algo por resuelto sí es un
// hecho y pide `write`. Lo que suplanta la voz, reescribir el documento, sigue
// pasando por `update_page` y su confirmación; aplicar una propuesta lo hace la
// persona en su editor, nunca el servidor.
//
// ── Retención ──────────────────────────────────────────────────────────────
// No se podan. Son el rastro de cómo se trabajó un texto, unidades por página
// y por semana, y viajan en el export. Lo que se acota es lo que se lee: las
// lecturas van por estado y con techo (`lib/reviews.ts`).

const CATEGORIES = reviewCategory.members.map((m) => m.value) as [ReviewCategory, ...ReviewCategory[]];
const SEVERITIES = reviewSeverity.members.map((m) => m.value) as [ReviewSeverity, ...ReviewSeverity[]];

const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());

/** Quién escribió algo, dicho como lo lee la pantalla. Sólo el conector es el agente. */
const autorDe = (via: ActorChannel) => (via === 'oauth' ? ('agent' as const) : ('person' as const));

/** A quién le toca contestar después de que escriba `channel`. */
const turnoTras = (channel: Channel): CommentTurn => (channel === 'oauth' ? 'person' : 'agent');

export function commentItem(doc: Doc<'pageComments'>) {
  return {
    id: doc._id,
    pageId: doc.pageId,
    reviewId: doc.reviewId ?? null,
    quote: doc.quote,
    prefix: doc.prefix ?? null,
    suffix: doc.suffix ?? null,
    category: doc.category ?? null,
    severity: doc.severity ?? null,
    body: doc.body,
    hint: doc.hint ?? null,
    suggestion: doc.suggestion ?? null,
    status: doc.status,
    resolution: doc.resolution ?? null,
    resolvedAt: iso(doc.resolvedAt),
    awaiting: doc.awaiting ?? null,
    author: autorDe(doc.createdVia),
    replies: doc.replies.map((reply) => ({
      id: reply.id,
      body: reply.body,
      author: autorDe(reply.via),
      createdAt: iso(reply.createdAt)!,
    })),
    createdAt: iso(doc.createdAt)!,
    updatedAt: iso(doc.updatedAt)!,
  };
}
export type CommentItem = ReturnType<typeof commentItem>;

function reviewItem(doc: Doc<'pageReviews'>, comments: readonly Doc<'pageComments'>[] | null) {
  return {
    id: doc._id,
    summary: doc.summary ?? null,
    reviewer: doc.reviewer ?? null,
    author: autorDe(doc.createdVia),
    closedAt: iso(doc.closedAt),
    createdAt: iso(doc.createdAt)!,
    // Las abiertas traen su barra, y la última aunque esté cerrada; las demás ya dijeron lo que tenían que decir.
    progress: comments ? reviewProgress(comments) : null,
  };
}
export type ReviewItem = ReturnType<typeof reviewItem>;

/** La página de quien llama, viva, o nada. */
async function paginaViva(ctx: QueryCtx | MutationCtx, userId: Id<'users'>, pageId: Id<'pages'>) {
  const page = await ctx.db.get(pageId);
  if (!page || page.userId !== userId || page.deletedAt !== undefined) return null;
  return page;
}

async function ownComment(ctx: QueryCtx | MutationCtx, userId: Id<'users'>, id: Id<'pageComments'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId) notFound('Comment not found');
  const page = await paginaViva(ctx, userId, doc.pageId);
  if (!page) notFound('Page not found');
  return doc;
}

/**
 * Los comentarios de una pasada. Sin tope en la lectura porque el tope está en
 * la escritura: una pasada nace con `MAX_COMMENTS_PER_REVIEW` como máximo y no
 * gana comentarios después.
 */
function deLaPasada(ctx: QueryCtx | MutationCtx, reviewId: Id<'pageReviews'>) {
  return ctx.db
    .query('pageComments')
    .withIndex('by_review', (q) => q.eq('reviewId', reviewId))
    .collect();
}

/** Los abiertos de una página, acotados por `MAX_OPEN_PER_PAGE`, que es su techo de escritura. */
function abiertosDe(ctx: QueryCtx | MutationCtx, pageId: Id<'pages'>) {
  return ctx.db
    .query('pageComments')
    .withIndex('by_page_status_updated', (q) => q.eq('pageId', pageId).eq('status', 'open'))
    .take(MAX_OPEN_PER_PAGE);
}

/**
 * Cierra la pasada si ya no le queda nada abierto, o la reabre si vuelve a
 * tenerlo. Devuelve si este cambio la cerró, que es la señal para celebrar.
 */
async function sellarPasada(ctx: MutationCtx, reviewId: Id<'pageReviews'> | undefined): Promise<boolean> {
  if (!reviewId) return false;
  const review = await ctx.db.get(reviewId);
  if (!review) return false;
  const comments = await deLaPasada(ctx, reviewId);
  const quedan = comments.some((c) => c.status === 'open');
  const now = Date.now();
  if (!quedan && review.closedAt === undefined) {
    await ctx.db.patch(reviewId, { closedAt: now, updatedAt: now });
    return true;
  }
  if (quedan && review.closedAt !== undefined) await ctx.db.patch(reviewId, { closedAt: undefined, updatedAt: now });
  return false;
}

/**
 * La barra de la página: los comentarios de cada pasada abierta, juntos. Sin
 * ninguna abierta, la de la última pasada, que es la que se acaba de cerrar:
 * una barra que se vacía en el instante en que se llena borra el momento.
 */
async function barraDeLaPagina(ctx: QueryCtx | MutationCtx, reviews: readonly Doc<'pageReviews'>[]) {
  const abiertas = reviews.some((r) => r.closedAt === undefined)
    ? reviews.filter((r) => r.closedAt === undefined)
    : reviews.slice(0, 1);
  const porPasada = new Map<Id<'pageReviews'>, Doc<'pageComments'>[]>();
  for (const review of abiertas) porPasada.set(review._id, await deLaPasada(ctx, review._id));
  return { abiertas: porPasada, progress: reviewProgress([...porPasada.values()].flat()) };
}

function pasadasRecientes(ctx: QueryCtx | MutationCtx, pageId: Id<'pages'>) {
  return ctx.db
    .query('pageReviews')
    .withIndex('by_page_created', (q) => q.eq('pageId', pageId))
    .order('desc')
    .take(REVIEWS_SHOWN);
}

// ── Lecturas ────────────────────────────────────────────────────────────────

/**
 * Lo que pinta el panel de revisión: las pasadas recientes, la barra de las
 * que siguen abiertas y los comentarios. Lee tres rangos acotados: abiertos
 * (techo de escritura), y los cerrados más recientes de cada estado.
 */
export const byPage = kinoZodQuery({
  args: { pageId: zid('pages') },
  handler: async (ctx, { pageId }) => {
    const page = await paginaViva(ctx, ctx.user._id, pageId);
    if (!page) return { reviews: [], comments: [], progress: reviewProgress([]), awaitingAgent: 0 };
    const cerrados = (status: 'resolved' | 'dismissed') =>
      ctx.db
        .query('pageComments')
        .withIndex('by_page_status_updated', (q) => q.eq('pageId', pageId).eq('status', status))
        .order('desc')
        .take(CLOSED_SHOWN);
    const [open, resolved, dismissed, reviews] = await Promise.all([
      abiertosDe(ctx, pageId),
      cerrados('resolved'),
      cerrados('dismissed'),
      pasadasRecientes(ctx, pageId),
    ]);
    const { abiertas, progress } = await barraDeLaPagina(ctx, reviews);
    const comments = [...open, ...resolved, ...dismissed].filter((c) => c.userId === ctx.user._id);
    return {
      reviews: reviews.map((r) => reviewItem(r, abiertas.get(r._id) ?? null)),
      comments: comments.map(commentItem),
      progress,
      awaitingAgent: open.filter((c) => c.awaiting === 'agent').length,
    };
  },
});

/** Si la cita de un comentario sigue en el texto guardado de su página. */
function anclaje(plain: string, doc: Doc<'pageComments'>): QuoteMatch['status'] {
  return locateQuote(plain, { exact: doc.quote, prefix: doc.prefix, suffix: doc.suffix }).status;
}

/**
 * La misma revisión, para el agente que vuelve a mirarla. Cada comentario
 * trae `anchor`: `found` si su cita sigue en el texto guardado, `missing` si
 * ya no está (la persona lo reescribió, o lo borró). Es lo que le deja al
 * agente comprobar un arreglo en vez de suponerlo.
 */
export const forAgent = kinoZodQuery({
  args: { pageId: zid('pages'), status: z.enum(['open', 'all']).optional() },
  handler: async (ctx, { pageId, status = 'open' }) => {
    const page = await paginaViva(ctx, ctx.user._id, pageId);
    if (!page) notFound('Page not found');
    const plain = htmlToPlainText(page.content);
    const docs =
      status === 'open'
        ? await abiertosDe(ctx, pageId)
        : [
            ...(await abiertosDe(ctx, pageId)),
            ...(await ctx.db
              .query('pageComments')
              .withIndex('by_page_status_updated', (q) => q.eq('pageId', pageId).eq('status', 'resolved'))
              .order('desc')
              .take(CLOSED_SHOWN)),
            ...(await ctx.db
              .query('pageComments')
              .withIndex('by_page_status_updated', (q) => q.eq('pageId', pageId).eq('status', 'dismissed'))
              .order('desc')
              .take(CLOSED_SHOWN)),
          ];
    const reviews = await pasadasRecientes(ctx, pageId);
    const { abiertas, progress } = await barraDeLaPagina(ctx, reviews);
    return {
      pageId: page._id,
      title: page.title ?? null,
      updatedAt: iso(page.updatedAt)!,
      progress,
      reviews: reviews.map((r) => reviewItem(r, abiertas.get(r._id) ?? null)),
      comments: docs
        .filter((c) => c.userId === ctx.user._id)
        .map((c) => ({ ...commentItem(c), anchor: anclaje(plain, c) })),
    };
  },
});

/** Hilos en los que la persona contestó y espera al agente, en cualquier página. */
export const AWAITING_SHOWN = 50;

export const awaitingAgent = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query('pageComments')
      .withIndex('by_user_awaiting', (q) => q.eq('userId', ctx.user._id).eq('awaiting', 'agent'))
      .take(AWAITING_SHOWN);
    const titulos = new Map<Id<'pages'>, string | null>();
    const items = [];
    for (const doc of docs) {
      if (!titulos.has(doc.pageId)) {
        const page = await paginaViva(ctx, ctx.user._id, doc.pageId);
        titulos.set(doc.pageId, page ? (page.title ?? '') : null);
      }
      const title = titulos.get(doc.pageId);
      if (title === null || title === undefined) continue;
      items.push({ ...commentItem(doc), pageTitle: title || null });
    }
    return items;
  },
});

// ── Escrituras ──────────────────────────────────────────────────────────────

const cita = {
  quote: z.string().trim().min(1).max(QUOTE_MAX, `La cita pasa de ${QUOTE_MAX} caracteres: comenta una frase, no el capítulo.`),
  prefix: z.string().max(AFFIX_MAX).optional(),
  suffix: z.string().max(AFFIX_MAX).optional(),
};

const cuerpo = z.string().trim().min(1).max(BODY_MAX);

const comentarioNuevo = z.object({
  ...cita,
  category: z.enum(CATEGORIES),
  severity: z.enum(SEVERITIES),
  body: cuerpo,
  hint: z.string().trim().max(HINT_MAX).optional(),
  suggestion: z.string().max(SUGGESTION_MAX).optional(),
});

async function abiertosDisponibles(ctx: MutationCtx, pageId: Id<'pages'>, nuevos: number) {
  const abiertos = (await abiertosDe(ctx, pageId)).length;
  if (abiertos + nuevos > MAX_OPEN_PER_PAGE) {
    invalid(
      `La página ya tiene ${abiertos} comentarios abiertos y el techo es ${MAX_OPEN_PER_PAGE}. Que la persona cierre algunos antes de añadir más.`,
    );
  }
}

/**
 * Una pasada entera, de una vez: como una review de GitHub, que se escribe en
 * borrador y se manda junta. Todo o nada: si una sola cita no se encuentra en
 * el texto guardado, no se escribe ninguna y el error dice cuáles fallaron,
 * para que el agente las corrija y reintente.
 */
export const create = kinoZodProposal({
  args: {
    pageId: zid('pages'),
    summary: z.string().trim().max(SUMMARY_MAX).optional(),
    reviewer: z.string().trim().max(REVIEWER_MAX).optional(),
    comments: z.array(comentarioNuevo).min(1).max(MAX_COMMENTS_PER_REVIEW),
  },
  handler: async (ctx, { pageId, summary, reviewer, comments }) => {
    const page = await paginaViva(ctx, ctx.user._id, pageId);
    if (!page) notFound('Page not found');

    const plain = htmlToPlainText(page.content);
    const fallos = comments.flatMap((c, index) => {
      const match = locateQuote(plain, { exact: c.quote, prefix: c.prefix, suffix: c.suffix });
      if (match.status === 'found') return [];
      const motivo =
        match.status === 'missing'
          ? 'no está en el texto guardado'
          : `aparece ${match.count} veces: añade prefix o suffix con las palabras de alrededor`;
      return [`#${index} «${c.quote.slice(0, 80)}»: ${motivo}`];
    });
    if (fallos.length > 0) {
      invalid(`Ninguna cita se guardó. Corrige estas y vuelve a mandar la pasada entera:\n${fallos.join('\n')}`);
    }
    await abiertosDisponibles(ctx, pageId, comments.length);

    const now = Date.now();
    const reviewId = await ctx.db.insert('pageReviews', {
      userId: ctx.user._id,
      pageId,
      systemId: page.systemId,
      summary: summary || undefined,
      reviewer: reviewer || undefined,
      sourceClientId: ctx.clientId,
      createdBy: ctx.user._id,
      createdVia: ctx.channel,
      createdAt: now,
      updatedAt: now,
    });
    for (const c of comments) {
      await ctx.db.insert('pageComments', {
        userId: ctx.user._id,
        pageId,
        systemId: page.systemId,
        reviewId,
        quote: c.quote,
        prefix: c.prefix || undefined,
        suffix: c.suffix || undefined,
        category: c.category,
        severity: c.severity,
        body: c.body,
        hint: c.hint || undefined,
        suggestion: c.suggestion || undefined,
        status: 'open',
        replies: [],
        createdBy: ctx.user._id,
        createdVia: ctx.channel,
        createdAt: now,
        updatedAt: now,
      });
    }
    await recordEvent(ctx, {
      userId: ctx.user._id,
      systemId: page.systemId,
      actorChannel: ctx.channel,
      action: 'review.create',
      targetType: 'page',
      targetId: pageId,
      payload: { reviewId, comments: comments.length },
    });
    const review = (await ctx.db.get(reviewId))!;
    return reviewItem(review, await deLaPasada(ctx, reviewId));
  },
});

/**
 * Una pregunta sobre un fragmento, abierta por la persona para que su agente
 * la conteste. La cita no se comprueba contra el texto guardado: sale de una
 * selección real del editor, y lo recién escrito puede no haberse guardado aún.
 */
export const ask = kinoZodMutation({
  args: { pageId: zid('pages'), ...cita, body: cuerpo },
  handler: async (ctx, { pageId, quote, prefix, suffix, body }) => {
    const page = await paginaViva(ctx, ctx.user._id, pageId);
    if (!page) notFound('Page not found');
    await abiertosDisponibles(ctx, pageId, 1);
    const now = Date.now();
    const id = await ctx.db.insert('pageComments', {
      userId: ctx.user._id,
      pageId,
      systemId: page.systemId,
      quote,
      prefix: prefix || undefined,
      suffix: suffix || undefined,
      body,
      status: 'open',
      awaiting: turnoTras(ctx.channel),
      replies: [],
      createdBy: ctx.user._id,
      createdVia: ctx.channel,
      createdAt: now,
      updatedAt: now,
    });
    await recordEvent(ctx, {
      userId: ctx.user._id,
      systemId: page.systemId,
      actorChannel: ctx.channel,
      action: 'pageComment.ask',
      targetType: 'page',
      targetId: pageId,
      payload: { commentId: id },
    });
    return commentItem((await ctx.db.get(id))!);
  },
});

function conRespuesta(doc: Doc<'pageComments'>, channel: Channel, body: string, now: number) {
  if (doc.replies.length >= MAX_REPLIES) {
    invalid(`El hilo ya tiene ${MAX_REPLIES} respuestas. Lo que falte decir cabe en un comentario nuevo.`);
  }
  return [...doc.replies, { id: crypto.randomUUID(), body, via: channel, createdAt: now }];
}

/** Deja la fila del log. La acción va escrita como `action:` en cada llamada para que `item-events.test.ts` la encuentre. */
async function registrar(ctx: MutationCtx & Caller, doc: Doc<'pageComments'>, { action }: { action: string }) {
  await recordEvent(ctx, {
    userId: ctx.user._id,
    systemId: doc.systemId,
    actorChannel: ctx.channel,
    action,
    targetType: 'page',
    targetId: doc.pageId,
    payload: { commentId: doc._id },
  });
}

/** Contestar en el hilo. Le pasa el turno al otro lado. */
export const reply = kinoZodProposal({
  args: { id: zid('pageComments'), body: cuerpo },
  handler: async (ctx, { id, body }) => {
    const doc = await ownComment(ctx, ctx.user._id, id);
    const now = Date.now();
    await ctx.db.patch(id, {
      replies: conRespuesta(doc, ctx.channel, body, now),
      // Un hilo cerrado no espera a nadie aunque alguien diga algo más en él.
      awaiting: doc.status === 'open' ? turnoTras(ctx.channel) : undefined,
      updatedAt: now,
    });
    await registrar(ctx, doc, { action: 'pageComment.reply' });
    return commentItem((await ctx.db.get(id))!);
  },
});

/** Lo que devuelve cerrar o reabrir: el comentario y si eso cerró su pasada. */
async function trasCerrar(ctx: MutationCtx, id: Id<'pageComments'>) {
  const doc = (await ctx.db.get(id))!;
  const reviewClosed = await sellarPasada(ctx, doc.reviewId);
  return { comment: commentItem(doc), reviewClosed };
}

/**
 * Darlo por resuelto. Desde el navegador la persona dice cómo (lo reescribió,
 * aplicó la propuesta o lo da por bueno); desde el conector el agente sólo
 * puede decir que lo comprobó, y sólo en sus comentarios de revisión: una
 * pregunta de la persona la cierra quien la hizo.
 */
export const resolve = kinoZodMutation({
  args: {
    id: zid('pageComments'),
    resolution: z.enum(['edited', 'applied', 'marked']).optional(),
    note: z.string().trim().min(1).max(BODY_MAX).optional(),
  },
  handler: async (ctx, { id, resolution, note }) => {
    const doc = await ownComment(ctx, ctx.user._id, id);
    if (ctx.channel === 'oauth' && !doc.reviewId) {
      forbidden('Una pregunta de la persona la cierra ella. Contesta en el hilo con reply_to_page_comment.');
    }
    if (doc.status !== 'open') return { comment: commentItem(doc), reviewClosed: false };
    const now = Date.now();
    await ctx.db.patch(id, {
      status: 'resolved',
      resolution: ctx.channel === 'oauth' ? 'verified' : (resolution ?? 'marked'),
      resolvedAt: now,
      resolvedVia: ctx.channel,
      awaiting: undefined,
      replies: note ? conRespuesta(doc, ctx.channel, note, now) : doc.replies,
      updatedAt: now,
    });
    await registrar(ctx, doc, { action: 'pageComment.resolve' });
    return trasCerrar(ctx, id);
  },
});

/**
 * Descartarlo. Cuenta como avanzar: decidir con criterio que un comentario no
 * aplica es tan trabajo como arreglarlo, y obligar a aceptar enseña a aceptar
 * a ciegas. El motivo, si lo hay, queda en el hilo para que la siguiente pasada
 * lo lea. El agente sólo retira los suyos.
 */
export const dismiss = kinoZodProposal({
  args: { id: zid('pageComments'), reason: z.string().trim().min(1).max(BODY_MAX).optional() },
  handler: async (ctx, { id, reason }) => {
    const doc = await ownComment(ctx, ctx.user._id, id);
    if (ctx.channel === 'oauth' && doc.createdVia !== 'oauth') {
      forbidden('Sólo puedes retirar tus propios comentarios.');
    }
    if (doc.status !== 'open') return { comment: commentItem(doc), reviewClosed: false };
    const now = Date.now();
    await ctx.db.patch(id, {
      status: 'dismissed',
      resolution: undefined,
      resolvedAt: now,
      resolvedVia: ctx.channel,
      awaiting: undefined,
      replies: reason ? conRespuesta(doc, ctx.channel, reason, now) : doc.replies,
      updatedAt: now,
    });
    await registrar(ctx, doc, { action: 'pageComment.dismiss' });
    return trasCerrar(ctx, id);
  },
});

/** Deshacer un cierre. La pasada vuelve a abrirse si se había cerrado con él. */
export const reopen = kinoZodMutation({
  args: { id: zid('pageComments') },
  handler: async (ctx, { id }) => {
    const doc = await ownComment(ctx, ctx.user._id, id);
    if (doc.status === 'open') return { comment: commentItem(doc), reviewClosed: false };
    await abiertosDisponibles(ctx, doc.pageId, 1);
    await ctx.db.patch(id, {
      status: 'open',
      resolution: undefined,
      resolvedAt: undefined,
      resolvedVia: undefined,
      updatedAt: Date.now(),
    });
    await registrar(ctx, doc, { action: 'pageComment.reopen' });
    return trasCerrar(ctx, id);
  },
});

/**
 * Corregir un comentario propio: el agente afina lo que dijo en una segunda
 * pasada, la persona su pregunta. Nadie reescribe lo que escribió el otro.
 */
export const update = kinoZodProposal({
  args: {
    id: zid('pageComments'),
    body: cuerpo.optional(),
    hint: z.string().trim().max(HINT_MAX).nullable().optional(),
    suggestion: z.string().max(SUGGESTION_MAX).nullable().optional(),
    severity: z.enum(SEVERITIES).optional(),
    category: z.enum(CATEGORIES).optional(),
  },
  handler: async (ctx, { id, ...data }) => {
    const doc = await ownComment(ctx, ctx.user._id, id);
    if (autorDe(doc.createdVia) !== autorDe(ctx.channel)) {
      forbidden('Sólo se corrige un comentario propio. Para discrepar, contesta en el hilo.');
    }
    const patch: Partial<Doc<'pageComments'>> = { updatedAt: Date.now() };
    if (data.body !== undefined) patch.body = data.body;
    if (data.hint !== undefined) patch.hint = data.hint || undefined;
    if (data.suggestion !== undefined) patch.suggestion = data.suggestion || undefined;
    if (doc.reviewId) {
      if (data.severity !== undefined) patch.severity = data.severity;
      if (data.category !== undefined) patch.category = data.category;
    }
    await ctx.db.patch(id, patch);
    await registrar(ctx, doc, { action: 'pageComment.update' });
    return commentItem((await ctx.db.get(id))!);
  },
});
