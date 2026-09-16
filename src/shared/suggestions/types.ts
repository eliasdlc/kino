/**
 * El patrón de sugerencia con razón, compartido entre el estudio de escritura y
 * el mini cerebro del sistema.
 *
 * Lo que hace que valga la pena compartirlo no es la forma de los campos: es que
 * `reason` es obligatorio. Una sugerencia sin el dato del que sale no compila, y
 * esa es la promesa del producto escrita en el sistema de tipos en vez de en una
 * norma que alguien recuerda a veces. Inteligencia que no miente quiere decir
 * que cada señalamiento se puede ir a verificar.
 */

/**
 * A dónde lleva una sugerencia. Cada slice cierra `kind` con su propia unión al
 * instanciar `Suggestion`; aquí queda abierto porque compartido no sabe qué
 * pantallas existen.
 */
export interface SuggestionTarget {
  kind: string;
  id: string;
}

export interface Suggestion<
  TKind extends string = string,
  TTarget extends SuggestionTarget = SuggestionTarget,
> {
  kind: TKind;
  title: string;
  /** El dato concreto del que sale. Siempre comprobable. */
  reason: string;
  /** A dónde lleva la sugerencia, si lleva a algún sitio. */
  target?: TTarget;
  /** Orden de presentación; mayor primero. */
  weight: number;
}

/**
 * Una regla mira las señales y decide. `null` es «no aplica», que no es lo mismo
 * que «aplica con poco peso»: lo primero no se pinta nunca y lo segundo baja en
 * la lista. Mantener esa diferencia es lo que evita rellenar una lista corta con
 * señales débiles, que es exactamente lo que convierte un detector en ruido.
 */
export type SuggestionRule<TSignals, TSuggestion extends Suggestion> = (
  signals: TSignals,
) => TSuggestion | null;
