/**
 * Loop predicción → verificación (Fase 4.2).
 *
 * El norte del producto es poder decir en pantalla, sin mentir: *"predije X, tu
 * check-in confirmó Y, mi modelo mejoró Z %"*. Para que eso no sea circular la
 * predicción se escribe **antes** de conocer el resultado (tabla
 * `energy_predictions`) y el alpha se guarda antes y después de recalibrar.
 *
 * Módulo puro: la comparación y su veredicto no tocan la base.
 */

import type { CheckinSlot } from './energy.schemas';

/** Horas que cubre cada slot. La madrugada (0–5) cuenta como noche, igual que `slotForHour`. */
export const SLOT_HOUR_RANGES: Record<CheckinSlot, readonly number[]> = {
  morning: [6, 7, 8, 9, 10, 11],
  afternoon: [12, 13, 14, 15, 16, 17],
  evening: [18, 19, 20, 21, 22, 23],
};

/**
 * Nivel que Kino espera para un slot: el promedio de la curva en sus horas.
 *
 * Neutral al sueño a propósito — al predecir todavía no se sabe cómo durmió el
 * usuario, así que la predicción asume la capacidad plena de la curva y el sueño
 * reportado después explica parte del error en vez de contaminar la predicción.
 */
export function predictLevelForSlot(curve: readonly number[], slot: CheckinSlot): number {
  const hours = SLOT_HOUR_RANGES[slot];
  const sum = hours.reduce((acc, h) => acc + (curve[h] ?? 0), 0);
  const mean = sum / hours.length;
  // El check-in vive en 1–100: la predicción se compara contra esa escala.
  return Math.max(1, Math.min(100, Math.round(mean)));
}

export type PredictionVerdict = 'hit' | 'close' | 'miss';

const HIT_TOLERANCE = 10;
const CLOSE_TOLERANCE = 25;

/** Veredicto objetivo de la predicción frente al nivel reportado. */
export function verdictFor(predicted: number, reported: number): PredictionVerdict {
  const gap = Math.abs(reported - predicted);
  if (gap <= HIT_TOLERANCE) return 'hit';
  if (gap <= CLOSE_TOLERANCE) return 'close';
  return 'miss';
}

export const VERDICT_LABELS: Record<PredictionVerdict, string> = {
  hit: 'Acerté',
  close: 'Cerca',
  miss: 'Me equivoqué',
};

/**
 * Cuánto mejoró el modelo con este dato, en puntos porcentuales de personalización.
 * Se redondea a un decimal: un check-in mueve el alpha poco, y redondear a entero
 * mostraría "0 %" en casi todos los casos reales.
 */
export function alphaImprovementPct(before: number | null, after: number | null): number | null {
  if (before === null || after === null) return null;
  const delta = (after - before) * 100;
  if (delta <= 0) return null; // el modelo no mejoró: no se inventa una mejora
  return Math.round(delta * 10) / 10;
}

export interface VerificationLoop {
  slot: CheckinSlot;
  /** Lo que Kino predijo, leído de la fila escrita antes del check-in. */
  predictedLevel: number;
  /** Lo que el usuario reportó. */
  reportedLevel: number;
  /** reportado − predicho (positivo = tenías más energía de la esperada). */
  delta: number;
  verdict: PredictionVerdict;
  /** Personalización antes/después de recalibrar con este check-in, en %. */
  alphaBeforePct: number | null;
  alphaAfterPct: number | null;
  /** Mejora atribuible a este check-in, en puntos porcentuales. Null si no mejoró. */
  improvementPct: number | null;
  /** Si la predicción salió de una curva ya personalizada o del cronotipo puro. */
  fromLearnedCurve: boolean;
  /** El veredicto que dio el propio usuario, si ya lo dio. */
  userVerdict: 'accurate' | 'partial' | 'inaccurate' | null;
}

export interface LoopInputs {
  slot: CheckinSlot;
  predictedLevel: number;
  reportedLevel: number;
  alphaAtPrediction: number;
  alphaBefore: number | null;
  alphaAfter: number | null;
  userVerdict: 'accurate' | 'partial' | 'inaccurate' | null;
}

/** Arma el loop verificable a partir de la predicción guardada y el check-in. */
export function buildVerificationLoop(input: LoopInputs): VerificationLoop {
  const { slot, predictedLevel, reportedLevel, alphaAtPrediction, alphaBefore, alphaAfter, userVerdict } = input;

  return {
    slot,
    predictedLevel,
    reportedLevel,
    delta: reportedLevel - predictedLevel,
    verdict: verdictFor(predictedLevel, reportedLevel),
    alphaBeforePct: alphaBefore !== null ? Math.round(alphaBefore * 100) : null,
    alphaAfterPct: alphaAfter !== null ? Math.round(alphaAfter * 100) : null,
    improvementPct: alphaImprovementPct(alphaBefore, alphaAfter),
    fromLearnedCurve: alphaAtPrediction > 0,
    userVerdict,
  };
}
