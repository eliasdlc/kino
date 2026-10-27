import type { CommentResolution, CommentStatus, ReviewSeverity } from '../schema';

// Lo que se calcula de una revisión, sin base: el peso de cada comentario y la
// barra. Vive en el servidor porque el cliente nunca recalcula un puntaje, y
// es puro para que se pueda probar par a par.

/**
 * Comentarios que una pasada puede dejar. El exceso es el fallo más
 * documentado de los revisores automáticos: con diez comentarios por cambio
 * la gente deja de leerlos todos, y el ochenta por ciento acaban siendo
 * detalles. Veinte es un techo, no una meta; la tool le pide al agente doce o
 * menos, de lo grande a lo pequeño.
 */
export const MAX_COMMENTS_PER_REVIEW = 20;

/**
 * Comentarios abiertos que una página puede acumular. Es el rango que lee
 * `byPage` en cada suscripción: sin techo, una página revisada diez veces
 * releería cientos de documentos en cada tecla que la toque.
 */
export const MAX_OPEN_PER_PAGE = 100;

/** Cerrados que la página enseña, los más recientes. El resto sigue en la base y viaja en el export. */
export const CLOSED_SHOWN = 60;

/** Pasadas que la página enseña, las más recientes. */
export const REVIEWS_SHOWN = 10;

/** Respuestas por hilo. Un hilo de cuarenta mensajes ya es una conversación, y eso va en el chat del agente. */
export const MAX_REPLIES = 40;

/** El fragmento citado. Mil caracteres son un párrafo largo: se comenta una frase, no el capítulo. */
export const QUOTE_MAX = 1_000;
/** Contexto alrededor de la cita para desempatar, como el `prefix` de Hypothesis. Basta con unas palabras. */
export const AFFIX_MAX = 200;
/** La explicación de un comentario o una respuesta: qué pasa aquí, por qué importa y qué hacer. */
export const BODY_MAX = 4_000;
/** La pregunta para pensar. Es una pregunta, no otra explicación. */
export const HINT_MAX = 500;
/** El texto propuesto en lugar de la cita: el doble de la cita, para que quepa una reescritura algo más larga. */
export const SUGGESTION_MAX = 2_000;
/** El veredicto de conjunto de una pasada. */
export const SUMMARY_MAX = 4_000;
/** La etiqueta de quien revisó. */
export const REVIEWER_MAX = 60;

/**
 * Cuánto mueve la barra cerrar cada severidad. Sin pesos, veinte comas
 * llenan la barra igual que el argumento que no se sostiene, y la gente cierra
 * lo fácil y evita lo que importa.
 */
export const SEVERITY_WEIGHT: Record<ReviewSeverity, number> = {
  critical: 3,
  important: 2,
  suggestion: 1,
};

/** Lo mínimo de un comentario que hace falta para medir una pasada. */
export interface Medible {
  status: CommentStatus;
  severity?: ReviewSeverity;
  resolution?: CommentResolution;
}

export interface ReviewProgress {
  total: number;
  /** Cerrados: resueltos o descartados. Descartar con criterio también es avanzar. */
  closed: number;
  open: number;
  /** De 0 a 1, ponderado por severidad. */
  fraction: number;
  /** Abiertos por severidad, para decir «quedan 2 críticos» en vez de un porcentaje. */
  openBySeverity: Record<ReviewSeverity, number>;
  /** Cómo se cerraron, para el resumen del final. */
  closedHow: { edited: number; applied: number; marked: number; verified: number; dismissed: number };
}

export function reviewProgress(comments: readonly Medible[]): ReviewProgress {
  const openBySeverity: Record<ReviewSeverity, number> = { critical: 0, important: 0, suggestion: 0 };
  const closedHow = { edited: 0, applied: 0, marked: 0, verified: 0, dismissed: 0 };
  let peso = 0;
  let pesoCerrado = 0;
  let closed = 0;
  for (const comment of comments) {
    const w = SEVERITY_WEIGHT[comment.severity ?? 'suggestion'];
    peso += w;
    if (comment.status === 'open') {
      openBySeverity[comment.severity ?? 'suggestion'] += 1;
      continue;
    }
    closed += 1;
    pesoCerrado += w;
    if (comment.status === 'dismissed') closedHow.dismissed += 1;
    else closedHow[comment.resolution ?? 'marked'] += 1;
  }
  return {
    total: comments.length,
    closed,
    open: comments.length - closed,
    fraction: peso === 0 ? 0 : pesoCerrado / peso,
    openBySeverity,
    closedHow,
  };
}
