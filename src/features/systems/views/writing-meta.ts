/** Una obra parada desde este número de días se dice dormida. */
export const DIAS_DORMIDA = 3;

/** La meta de palabras de una obra, venga como número o como texto; null si no tiene. */
export function readWordGoal(meta: Record<string, unknown>): number | null {
  if (typeof meta.wordGoal === "number") return meta.wordGoal > 0 ? meta.wordGoal : null;
  if (typeof meta.wordGoal === "string") return Number(meta.wordGoal) || null;
  return null;
}
