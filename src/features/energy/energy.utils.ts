import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Task } from '@/features/tasks/tasks.types';

// ── Cronotipos y calidad de sueño ──────────────────────────────────────────

export type Chronotype = 'morning' | 'intermediate' | 'evening';
export type SleepQuality = 'good' | 'partial' | 'poor';

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
): number {
  const curve = CHRONOTYPE_CURVES[chronotype];
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
): number {
  const capacity = computeCapacity(hour, chronotype, sleepQuality);
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
  const due = parseISO(dueDate);
  const daysDiff = differenceInCalendarDays(due, today);
  if (daysDiff < 0) return 100;
  if (daysDiff === 0) return 80;
  if (daysDiff === 1) return 50;
  if (daysDiff <= 7) return 25;
  return 0;
}

function ageScore(createdAt: Date, today: Date): number {
  const days = Math.max(0, differenceInCalendarDays(today, createdAt));
  return Math.min(days * 2, 30);
}

export function computeImportance(task: Task, today: Date): number {
  const priority = PRIORITY_SCORE[task.priority ?? 'medium'] ?? 40;
  const urgency = urgencyScore(task.dueDate, today);
  const age = ageScore(task.createdAt, today);
  return 1.0 * urgency + 0.8 * priority + 0.3 * age;
}
