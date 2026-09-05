// Lo que la curva de energía sabe decir sin base: dónde está el pico.

/**
 * Ventana de dos horas consecutivas de mayor capacidad en una curva de 24
 * valores. Es la fuente única de "tu pico".
 */
export function findPeakRange(curve: readonly number[]): { start: number; end: number } {
  let bestScore = -1;
  let peakStart = 9;
  for (let h = 0; h < 23; h += 1) {
    const score = (curve[h] ?? 0) + (curve[h + 1] ?? 0);
    if (score > bestScore) {
      bestScore = score;
      peakStart = h;
    }
  }
  return { start: peakStart, end: peakStart + 2 };
}
