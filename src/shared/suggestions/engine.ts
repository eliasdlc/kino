import type { Suggestion, SuggestionRule } from "./types";

/**
 * El motor aritmético, sin modelo.
 *
 * Cero tokens y cero coste: corre las reglas que le den, tira las que no
 * aplican y ordena lo que queda. Toda la inteligencia vive en las reglas de
 * cada slice, que son cuentas sobre datos que ya existen; aquí solo está lo que
 * las dos consumidoras hacían igual y por separado.
 */

/**
 * Más peso primero, y a igual peso el `kind` alfabético. El desempate no es
 * cosmético: sin él, dos llamadas con las mismas señales pueden devolver dos
 * órdenes distintos y la lista baila entre repintados.
 */
export function rankSuggestions<TSuggestion extends Suggestion>(
  suggestions: readonly TSuggestion[],
): TSuggestion[] {
  return [...suggestions].sort(
    (a, b) => b.weight - a.weight || a.kind.localeCompare(b.kind),
  );
}

export interface BuildOptions {
  /**
   * Techo de sugerencias, no objetivo. Se recorta después de ordenar, así que lo
   * que sobrevive es lo de más peso. Sin tope, se devuelven todas.
   */
  limit?: number;
}

/**
 * Corre las reglas sobre las señales y devuelve lo que sobrevive, ordenado.
 */
export function buildSuggestions<TSignals, TSuggestion extends Suggestion>(
  signals: TSignals,
  rules: ReadonlyArray<SuggestionRule<TSignals, TSuggestion>>,
  { limit }: BuildOptions = {},
): TSuggestion[] {
  const found: TSuggestion[] = [];
  for (const rule of rules) {
    const suggestion = rule(signals);
    if (suggestion) found.push(suggestion);
  }
  const ranked = rankSuggestions(found);
  return limit === undefined ? ranked : ranked.slice(0, limit);
}
