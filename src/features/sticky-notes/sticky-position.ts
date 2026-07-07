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
