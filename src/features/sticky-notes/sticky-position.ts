/**
 * Modelo de posición de las sticky notes flotantes.
 *
 * Todas las notas flotantes se anclan a la COLUMNA DE TEXTO del cuaderno (el
 * bloque `max-w-3xl` centrado, de ancho fijo), no a los bordes del contenedor.
 * Así, cuando el sidebar se abre y el cuaderno se desplaza, la nota se mueve
 * junto con él y permanece sobre el mismo lugar del texto en vez de "rodarse".
 *
 * `positionX` es una fracción relativa a esa columna:
 *   0   = borde izquierdo de la columna
 *   1   = borde derecho de la columna
 *   < 0 = gutter izquierdo
 *   > 1 = gutter derecho
 */

/** X para el preset "margen izquierdo": nota apoyada en el gutter izquierdo. */
export const GUTTER_LEFT_X = -0.23;
/** X para el preset "margen derecho": nota apoyada en el gutter derecho. */
export const GUTTER_RIGHT_X = 1.03;

/**
 * Resuelve la X definitiva (columna-relativa) de una nota.
 *
 * Compatibilidad: las notas antiguas guardaban `positionX` como fracción [0,1]
 * del gutter con `positionSide` 'left'/'right'. Bajo el modelo nuevo esa X
 * caería sobre el texto, así que las remapeamos a su gutter. Las notas nuevas
 * nunca producen esa combinación (los presets usan X fuera de [0,1] y las
 * flotantes usan side 'over'), por lo que este remapeo solo afecta datos viejos.
 */
export function resolveColumnX(
  side: string | null,
  x: number | null | undefined
): number {
  if (x == null) {
    return side === "right" ? GUTTER_RIGHT_X : side === "left" ? GUTTER_LEFT_X : 0;
  }
  if ((side === "left" || side === "right") && x >= 0 && x <= 1) {
    return side === "right" ? GUTTER_RIGHT_X : GUTTER_LEFT_X;
  }
  return x;
}

/** Ancho de la tarjeta flotante en px (la clase `w-44`). */
export const NOTE_W = 176;
/**
 * Aire minimo entre la nota y el borde del contenedor.
 *
 * No es decoracion: la tarjeta se pinta con una inclinacion de hasta 3 grados,
 * y eso le ensancha la caja unos 6 px por lado cuando mide lo que mide acotada.
 * Con 8 px de aire la nota se salia 5 px de la ventana; con 16 no.
 */
const EDGE_PAD = 16;

/** Geometria del cuaderno en px, relativa al contenedor. */
export interface NotebookMetrics {
  /** La caja de la columna, que es el origen de `positionX`. */
  columnLeft: number;
  columnWidth: number;
  /**
   * Donde empieza y cuanto mide el **texto**, ya sin el padding de la columna.
   * El margen se mide contra esto y no contra la caja: el padding de la columna
   * no lleva texto, asi que una nota puede entrar ahi sin tapar nada. Medido a
   * 1440 con el panel abierto, la diferencia es lo que decide si la nota cabe
   * en el margen (176 de caja) o no (200 contando el texto).
   */
  textLeft: number;
  textWidth: number;
  containerW: number;
  containerH: number;
}

/**
 * Los dos margenes donde una nota puede vivir sin pisar el texto, en px
 * relativos al contenedor. Un margen que no da para la tarjeta no es un sitio:
 * devuelve `null` y la nota se va a la rejilla en vez de subirse a la prosa.
 */
export interface GutterSlots {
  left: { from: number; to: number } | null;
  right: { from: number; to: number } | null;
}

export function gutterSlots(m: NotebookMetrics): GutterSlots {
  const needed = NOTE_W + EDGE_PAD;
  const textRight = m.textLeft + m.textWidth;
  const rightRoom = m.containerW - textRight;
  return {
    left: m.textLeft >= needed ? { from: EDGE_PAD, to: m.textLeft - NOTE_W } : null,
    right: rightRoom >= needed ? { from: textRight, to: m.containerW - NOTE_W - EDGE_PAD } : null,
  };
}

/** Si el cuaderno tiene margen para al menos una nota flotante. */
export function hasGutterRoom(m: NotebookMetrics): boolean {
  const s = gutterSlots(m);
  return s.left !== null || s.right !== null;
}

/**
 * Lleva una X al margen mas cercano que si tiene sitio. Antes el tope se media
 * contra el contenedor entero (`containerW - NOTE_W`), asi que al estrechar la
 * ventana el margen desaparecia y la nota acababa encima del texto: medido el
 * 14 sep 2026, las mismas dos notas tapaban 0 parrafos a 1440 y 3 y 9 a 1131.
 */
export function clampToGutter(x: number, m: NotebookMetrics): number {
  const { left, right } = gutterSlots(m);
  if (!left && !right) return x;
  const centro = m.textLeft + m.textWidth / 2;
  const preferido = x + NOTE_W / 2 < centro ? (left ?? right!) : (right ?? left!);
  return Math.min(Math.max(x, preferido.from), Math.max(preferido.from, preferido.to));
}
