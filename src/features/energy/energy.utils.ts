import { differenceInCalendarDays } from 'date-fns';
import { parseDueDate } from '@/features/tasks/tasks.utils';
import type { CheckinSlot } from './energy.schemas';

// ── Cronotipos y calidad de sueño ──────────────────────────────────────────

export type Chronotype = 'morning' | 'intermediate' | 'evening';
export type SleepQuality = 'good' | 'partial' | 'poor';

/** Etiqueta en español del cronotipo para mostrar en la UI. */
export const CHRONOTYPE_LABELS: Record<Chronotype, string> = {
  morning: 'matutino',
  intermediate: 'intermedio',
  evening: 'vespertino',
};

const SLEEP_FACTOR: Record<SleepQuality, number> = {
  good: 1.0,
  partial: 0.8,
  poor: 0.6,
};

// Curvas circadianas por cronotipo (índice = hora 0–23, valor = capacidad 0–100).
// Basadas en el modelo de dos procesos (Borbély) y datos de cronotipología (Roenneberg).
// morning: pico 8–10 h; intermediate: pico 10–12 h; evening: pico 15–20 h.
export const CHRONOTYPE_CURVES: Record<Chronotype, readonly number[]> = {
  morning: [
    10, 5, 5, 5, 10, 25, 45, 65, 80, 90, 90, 85,
    75, 70, 60, 50, 40, 30, 20, 15, 10, 10, 10, 10,
  ],
  intermediate: [
    10, 5, 5, 5, 5, 10, 25, 45, 65, 80, 90, 90,
    85, 75, 70, 75, 65, 55, 45, 35, 25, 15, 10, 10,
  ],
  evening: [
    15, 10, 5, 5, 5, 5, 5, 10, 20, 30, 40, 50,
    55, 60, 70, 80, 85, 80, 75, 80, 75, 70, 55, 35,
  ],
};

/**
 * Capacidad proyectada para una hora del día, ajustada por cronotipo y sueño.
 * Resultado en [0, 100].
 */
export function computeCapacity(
  hour: number,
  chronotype: Chronotype,
  sleepQuality: SleepQuality,
  overrideCurve?: readonly number[],
): number {
  const curve = overrideCurve ?? CHRONOTYPE_CURVES[chronotype];
  const base = curve[Math.max(0, Math.min(23, Math.floor(hour)))] ?? 0;
  return base * SLEEP_FACTOR[sleepQuality];
}

// ── Fatiga y energía efectiva ──────────────────────────────────────────────

// Modelo de fatiga por ritmos ultradianos (~90 min): sube linealmente hasta 30 pts
// en el primer tramo (0–90 min), luego hasta el tope de 40 en el segundo (90–120 min).
const FATIGUE_AT_90 = 30;
const FATIGUE_MAX = 40;
const FATIGUE_INFLECTION_MIN = 90;
const FATIGUE_CAP_MIN = 120;

/**
 * Fatiga acumulada por trabajo continuo sin descanso (0–40 pts).
 * Un descanso la resetea a 0.
 */
export function computeFatigue(continuousWorkMinutes: number): number {
  const m = Math.max(0, continuousWorkMinutes);
  if (m <= FATIGUE_INFLECTION_MIN) {
    return m * (FATIGUE_AT_90 / FATIGUE_INFLECTION_MIN);
  }
  if (m <= FATIGUE_CAP_MIN) {
    return (
      FATIGUE_AT_90 +
      ((m - FATIGUE_INFLECTION_MIN) * (FATIGUE_MAX - FATIGUE_AT_90)) /
        (FATIGUE_CAP_MIN - FATIGUE_INFLECTION_MIN)
    );
  }
  return FATIGUE_MAX;
}

/**
 * Energía efectiva = capacidad circadiana − fatiga continua, con piso garantizado.
 * energía_efectiva = max(energyFloor, capacidad(t) − fatiga(continuousMin))
 */
export function computeEffectiveEnergy(
  hour: number,
  continuousWorkMinutes: number,
  chronotype: Chronotype,
  sleepQuality: SleepQuality,
  energyFloor = 20,
  overrideCurve?: readonly number[],
): number {
  const capacity = computeCapacity(hour, chronotype, sleepQuality, overrideCurve);
  const fatigue = computeFatigue(continuousWorkMinutes);
  return Math.max(energyFloor, capacity - fatigue);
}

const PRIORITY_SCORE: Record<string, number> = {
  critical: 100,
  high: 70,
  medium: 40,
  low: 15,
};

function urgencyScore(dueDate: string | null | undefined, today: Date): number {
  if (!dueDate) return 0;
  const due = parseDueDate(dueDate);
  const daysDiff = differenceInCalendarDays(due, today);
  if (daysDiff < 0) return 100;
  if (daysDiff === 0) return 80;
  if (daysDiff === 1) return 50;
  if (daysDiff <= 7) return 25;
  return 0;
}

function ageScore(createdAt: Date | string, today: Date): number {
  const days = Math.max(0, differenceInCalendarDays(today, new Date(createdAt)));
  return Math.min(days * 2, 30);
}

/**
 * Lo único que la importancia mira de una tarea. Pide el mínimo en vez de la
 * fila entera porque la puntúan los dos lados: el servidor sobre filas, donde
 * `createdAt` es un `Date`, y el cliente sobre lo que llegó por la red, donde
 * es texto.
 */
export interface Scorable {
  priority: string | null;
  dueDate: string | null;
  createdAt: Date | string;
}

export function computeImportance(task: Scorable, today: Date): number {
  const priority = PRIORITY_SCORE[task.priority ?? 'medium'] ?? 40;
  const urgency = urgencyScore(task.dueDate, today);
  const age = ageScore(task.createdAt, today);
  return 1.0 * urgency + 0.8 * priority + 0.3 * age;
}

// ── Slots y pico de la curva ────────────────────────────────────────────────

const SLOT_KEYS = ['morning', 'afternoon', 'evening'] as const;

/** Slot al que pertenece una hora. evening cubre 18–23 y la madrugada 0–5. */
export function slotForHour(hour: number): CheckinSlot {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

/** Formatea una hora 0–23 en 12h con AM/PM. 0→"12 AM", 12→"12 PM", 18→"6 PM". */
export function formatHour(hour: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}

/** Rango compacto: "6–8 PM" si comparten periodo, "11 AM – 1 PM" si no. */
export function formatHourRange(start: number, end: number): string {
  const s = ((Math.floor(start) % 24) + 24) % 24;
  const e = ((Math.floor(end) % 24) + 24) % 24;
  const sPeriod = s < 12 ? 'AM' : 'PM';
  const ePeriod = e < 12 ? 'AM' : 'PM';
  const s12 = s % 12 === 0 ? 12 : s % 12;
  const e12 = e % 12 === 0 ? 12 : e % 12;
  return sPeriod === ePeriod ? `${s12}–${e12} ${ePeriod}` : `${s12} ${sPeriod} – ${e12} ${ePeriod}`;
}

/**
 * Ventana de 2h consecutivas de mayor capacidad en una curva de 24 valores.
 * Fuente única de "tu pico": la usan el gráfico y la tarjeta "Tu patrón".
 */
export function findPeakRange(curve: readonly number[]): { start: number; end: number } {
  let bestScore = -1;
  let peakStart = 9;
  for (let h = 0; h < 23; h++) {
    const score = (curve[h] ?? 0) + (curve[h + 1] ?? 0);
    if (score > bestScore) {
      bestScore = score;
      peakStart = h;
    }
  }
  return { start: peakStart, end: peakStart + 2 };
}

export type PeakAdviceTone = 'peak' | 'before' | 'after' | 'rest';

export interface PeakAdvice {
  tone: PeakAdviceTone;
  text: string;
}

/** Consejo contextual según dónde está la hora actual respecto a tu pico. */
export function buildPeakAdvice(
  peak: { start: number; end: number } | null,
  currentHour: number,
): PeakAdvice {
  const h = ((Math.floor(currentHour) % 24) + 24) % 24;
  if (h >= 22 || h < 5) {
    return { tone: 'rest', text: 'Hora de bajar el ritmo y recargar para mañana.' };
  }
  if (!peak) {
    return { tone: 'after', text: 'Aún estoy aprendiendo tu ritmo: registra tu energía para afinar.' };
  }
  if (h >= peak.start && h < peak.end) {
    return { tone: 'peak', text: 'Estás en tu pico: aprovéchalo para lo más difícil.' };
  }
  if (h < peak.start) {
    const left = peak.start - h;
    return {
      tone: 'before',
      text: `Tu pico llega en ${left} h (${formatHourRange(peak.start, peak.end)}): guarda lo difícil para entonces.`,
    };
  }
  return {
    tone: 'after',
    text: `Tu pico (${formatHourRange(peak.start, peak.end)}) ya pasó: buen momento para tareas ligeras.`,
  };
}

// ── Pesos de la evidencia de actividad ──────────────────────────────────────

/** Cuánto pesa una señal según la energía que declaraba la tarea. */
const ENERGY_WEIGHTS: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** Un timer es señal más limpia que "completé": el reloj corrió de verdad. */
const TIMER_MULTIPLIER = 1.5;

/**
 * Peso de una sesión de escritura. No declara nivel de energía (un capítulo no
 * tiene `energyLevel`) pero es trabajo profundo por definición, así que cuenta
 * como un timer de tarea media. Sin esto, escribir todos los días no movía la
 * curva de la que el propio arquetipo Writing deriva su ventana creativa.
 */
const WRITING_SESSION_WEIGHT = ENERGY_WEIGHTS.medium! * TIMER_MULTIPLIER;

/** Peso de una tarea completada a cierta hora. */
export function completionWeight(energyLevel: string | null | undefined): number {
  return ENERGY_WEIGHTS[energyLevel ?? 'medium'] ?? 1;
}

/** Peso de una sesión cronometrada: timer de tarea o sesión de escritura. */
export function sessionWeight(
  source: 'timer' | 'writing',
  energyLevel: string | null | undefined,
): number {
  if (source === 'writing') return WRITING_SESSION_WEIGHT;
  return completionWeight(energyLevel) * TIMER_MULTIPLIER;
}

// ── Aprendizaje de la curva personal ────────────────────────────────────────

export interface AccuracyTally {
  accurate: number;
  partial: number;
  inaccurate: number;
}

export interface CalibrationSignals {
  /** Peso acumulado de actividad (tareas completadas + timers) por hora 0–23 */
  activityWeight: number[];
  /** Suma de niveles de check-in (1–100) por hora 0–23 */
  checkinLevelSum: number[];
  /** Conteo de check-ins por hora 0–23 */
  checkinCount: number[];
  /** Tally de feedback de precisión por slot */
  accuracyBySlot: Record<CheckinSlot, AccuracyTally>;
}

export interface LearnedCurve {
  curve: number[];
  /** Alpha global representativo (0–0.85) para el % de personalización */
  alpha: number;
  /** Alpha aplicado por slot al mezclar (más agresivo donde hay datos) */
  slotAlphas: Record<CheckinSlot, number>;
}

const SLOT_SATURATION = 30; // datos en un slot para acercarse a alpha máximo
const GLOBAL_SATURATION = 100;
const MAX_ALPHA = 0.85;
const MAX_SLOT_ALPHA = 0.9;
/** Un check-in es señal directa de energía → pesa más que un evento de actividad. */
const CHECKIN_WEIGHT = 2;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function emptyAccuracyBySlot(): Record<CheckinSlot, AccuracyTally> {
  return {
    morning: { accurate: 0, partial: 0, inaccurate: 0 },
    afternoon: { accurate: 0, partial: 0, inaccurate: 0 },
    evening: { accurate: 0, partial: 0, inaccurate: 0 },
  };
}

/**
 * Mezcla la curva teórica del cronotipo con la evidencia real del usuario.
 *
 * Personalización agresiva:
 *  - Los check-ins (señal directa) anclan la curva a la hora reportada.
 *  - Se aprende por slot: un slot con muchos datos se personaliza fuerte,
 *    uno sin datos queda teórico (alpha por slot, no global).
 *  - Si la predicción de un slot viene marcada "inaccurate", se sube su alpha
 *    para confiar más en los datos que en la teoría.
 *
 * Devuelve null si no hay ninguna señal (cold-start → no tocar la curva).
 */
export function computeLearnedCurve(
  chronotype: Chronotype,
  signals: CalibrationSignals,
): LearnedCurve | null {
  const theoretical = CHRONOTYPE_CURVES[chronotype];
  const { activityWeight, checkinLevelSum, checkinCount, accuracyBySlot } = signals;

  const totalActivity = activityWeight.reduce((s, v) => s + v, 0);
  const totalCheckins = checkinCount.reduce((s, v) => s + v, 0);
  const totalN = totalActivity + totalCheckins * CHECKIN_WEIGHT;
  if (totalN === 0) return null;

  // Curva de actividad normalizada a 0–100 por su propio máximo.
  const maxActivity = Math.max(...activityWeight);
  const activityCurve = activityWeight.map((v) =>
    maxActivity > 0 ? (v / maxActivity) * 100 : 0,
  );

  // Volumen de datos por slot → alpha por slot, ajustado por precisión.
  const slotN: Record<CheckinSlot, number> = { morning: 0, afternoon: 0, evening: 0 };
  for (let h = 0; h < 24; h++) {
    const slot = slotForHour(h);
    slotN[slot] += (activityWeight[h] ?? 0) + (checkinCount[h] ?? 0) * CHECKIN_WEIGHT;
  }

  const slotAlphas: Record<CheckinSlot, number> = { morning: 0, afternoon: 0, evening: 0 };
  for (const slot of SLOT_KEYS) {
    const base = clamp(slotN[slot] / SLOT_SATURATION, 0, MAX_SLOT_ALPHA);
    const t = accuracyBySlot[slot];
    const total = t.accurate + t.partial + t.inaccurate;
    const inaccurateRatio = total > 0 ? t.inaccurate / total : 0;
    slotAlphas[slot] = clamp(base * (1 + 0.5 * inaccurateRatio), 0, MAX_SLOT_ALPHA);
  }

  // Curva final: por hora, mezcla teórico↔empírico con el alpha de su slot.
  const curve = theoretical.map((theo, h) => {
    const cCount = checkinCount[h] ?? 0;
    const aVal = activityCurve[h] ?? 0;
    let empirical: number;
    if (cCount > 0) {
      const checkinLevel = (checkinLevelSum[h] ?? 0) / cCount; // 0–100 directo
      empirical = 0.7 * checkinLevel + 0.3 * aVal;
    } else {
      empirical = aVal;
    }
    // Sin señal empírica esa hora → no jalar a 0, mantener el teórico.
    if (empirical === 0) empirical = theo;
    const a = slotAlphas[slotForHour(h)];
    return Math.round(((1 - a) * theo + a * empirical) * 10) / 10;
  });

  const alpha = clamp(totalN / GLOBAL_SATURATION, 0, MAX_ALPHA);
  return { curve, alpha, slotAlphas };
}
