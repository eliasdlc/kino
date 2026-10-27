import { onTestFinished } from "vitest";

/**
 * Un puntero de dedo para el test en curso; vuelve al ratón al terminar. `matchMedia` de jsdom responde
 * que no a `(pointer: coarse)`, así que sin esto un test de la hoja de mover
 * probaría el camino del ratón y pasaría igual.
 */
export function conDedo(): void {
  const original = window.matchMedia;
  window.matchMedia = (query: string) => {
    const lista = original(query);
    if (query !== "(pointer: coarse)") return lista;
    return { ...lista, matches: true, media: query };
  };
  onTestFinished(() => {
    window.matchMedia = original;
  });
}
