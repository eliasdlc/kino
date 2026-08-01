import {
  computeImportance,
  computeEffectiveEnergy,
  computeCapacity,
  type Chronotype,
  type SleepQuality,
  CHRONOTYPE_CURVES,
} from './energy.utils';
import type { Task } from '@/features/tasks/tasks.types';

export interface PlanItem {
  task: Task;
  startsHere: boolean;
}

// ── Planificador consciente de energía ─────────────────────────────────────

export type TaskEnergyDemand = 'high' | 'medium' | 'low';

// Energía efectiva mínima requerida por nivel de demanda.
// Solo las tareas 'high' se difieren si no se alcanza el umbral; medium/low se colocan igual.
const ENERGY_THRESHOLDS: Record<TaskEnergyDemand, number> = {
  high: 60,
  medium: 35,
  low: 20,
};

const BREAK_MINUTES = 10;
const BREAK_THRESHOLD_MINUTES = 90;

export interface EnergyPlanItem {
  task: Task;
  /** Minuto absoluto desde medianoche en que comienza la tarea */
  scheduledStartMinute: number;
  /** Energía efectiva calculada al momento de colocar la tarea */
  effectiveEnergyAtStart: number;
  startsHere: boolean;
  /** El planner insertó un descanso justo antes de esta tarea */
  breakBefore: boolean;
}

/** Por qué una tarea no entró en el día. */
export type DeferralReason = 'budget' | 'energy';

export interface DeferredItem {
  task: Task;
  reason: DeferralReason;
}

export interface EnergyPlanResult {
  items: EnergyPlanItem[];
  /** Capacidad proyectada por hora (24 valores, índice = hora 0–23) */
  projectedCurve: readonly number[];
  totalBreakMinutes: number;
  /**
   * Tareas que no se pudieron ubicar, con su motivo. El motivo no es decorativo:
   * un agente que arma el día tiene que poder explicar por qué algo quedó fuera
   * ("no cabía" y "no alcanzaba tu energía" se resuelven distinto).
   */
  deferred: DeferredItem[];
}

export interface EnergyPlanOptions {
  tasks: Task[];
  availableHoursPerDay: number;
  chronotype: Chronotype;
  sleepQuality: SleepQuality;
  energyFloor: number;
  /** Hora de inicio del bloque de trabajo (0–23, default 9) */
  startHour?: number;
  today: Date;
  /** Curva aprendida del usuario (24 valores). Si está presente y tiene longitud 24, reemplaza la curva teórica del cronotipo. */
  learnedCurve?: readonly number[];
}

/**
 * Construye un plan de trabajo consciente de energía.
 * Coloca tareas high en picos circadianos, inserta descansos cada ~90 min y
 * difiere las tareas high que no alcanzan el umbral de energía.
 */
export function buildEnergyPlan(options: EnergyPlanOptions): EnergyPlanResult {
  const {
    tasks,
    availableHoursPerDay,
    chronotype,
    sleepQuality,
    energyFloor,
    startHour = 9,
    today,
    learnedCurve,
  } = options;

  const budgetMinutes = availableHoursPerDay * 60;

  const baseCurve: readonly number[] =
    learnedCurve && learnedCurve.length === 24
      ? learnedCurve
      : CHRONOTYPE_CURVES[chronotype];

  // Curva proyectada para todo el día (usada por la UI)
  const projectedCurve = baseCurve.map((_, h) =>
    computeCapacity(h, chronotype, sleepQuality, baseCurve),
  ) as unknown as readonly number[];

  const candidates = tasks.filter(
    (t) =>
      t.taskType !== 'idea' &&
      t.deletedAt === null &&
      (t.status === 'today' || t.status === 'tomorrow' || t.status === 'week'),
  );

  const sorted = [...candidates].sort(
    (a, b) => computeImportance(b, today) - computeImportance(a, today),
  );

  const items: EnergyPlanItem[] = [];
  const deferred: DeferredItem[] = [];

  let currentMinute = startHour * 60;
  let continuousWorkMinutes = 0;
  let usedMinutes = 0;
  let totalBreakMinutes = 0;

  for (const task of sorted) {
    const taskMinutes = estimatedMinutes(task.estimatedTime);

    // Insertar descanso si se superó el umbral de trabajo continuo
    let breakBefore = false;
    if (continuousWorkMinutes >= BREAK_THRESHOLD_MINUTES) {
      if (usedMinutes + BREAK_MINUTES <= budgetMinutes) {
        currentMinute += BREAK_MINUTES;
        usedMinutes += BREAK_MINUTES;
        totalBreakMinutes += BREAK_MINUTES;
        continuousWorkMinutes = 0;
        breakBefore = true;
      }
    }

    // Presupuesto agotado
    if (usedMinutes + taskMinutes > budgetMinutes) {
      deferred.push({ task, reason: 'budget' });
      continue;
    }

    const currentHour = Math.min(23, Math.floor(currentMinute / 60));
    const effectiveEnergy = computeEffectiveEnergy(
      currentHour,
      continuousWorkMinutes,
      chronotype,
      sleepQuality,
      energyFloor,
      baseCurve,
    );

    const demand = (task.energyLevel ?? 'medium') as TaskEnergyDemand;

    // Solo las tareas 'high' se difieren por energía insuficiente
    if (demand === 'high' && effectiveEnergy < ENERGY_THRESHOLDS.high) {
      deferred.push({ task, reason: 'energy' });
      continue; // no avanzar el reloj — la ranura sigue libre para la siguiente tarea
    }

    items.push({
      task,
      scheduledStartMinute: currentMinute,
      effectiveEnergyAtStart: effectiveEnergy,
      startsHere: items.length === 0,
      breakBefore,
    });

    currentMinute += taskMinutes;
    usedMinutes += taskMinutes;
    continuousWorkMinutes += taskMinutes;
  }

  return { items, projectedCurve, totalBreakMinutes, deferred };
}

const DEFAULT_TASK_MINUTES = 30;

function estimatedMinutes(estimatedTime: string | null | undefined): number {
  if (!estimatedTime) return DEFAULT_TASK_MINUTES;
  // Format: HH:MM:SS
  const parts = estimatedTime.split(':');
  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);
  return hours * 60 + minutes;
}

export function buildBudgetPlan(
  tasks: Task[],
  availableHoursPerDay: number,
  today: Date,
): PlanItem[] {
  const budgetMinutes = availableHoursPerDay * 60;

  const candidates = tasks.filter(
    (t) =>
      t.taskType !== 'idea' &&
      t.deletedAt === null &&
      (t.status === 'today' || t.status === 'tomorrow' || t.status === 'week'),
  );

  const sorted = [...candidates].sort(
    (a, b) => computeImportance(b, today) - computeImportance(a, today),
  );

  const plan: PlanItem[] = [];
  let usedMinutes = 0;

  for (const task of sorted) {
    const taskMinutes = estimatedMinutes(task.estimatedTime);
    if (usedMinutes + taskMinutes > budgetMinutes) continue;
    plan.push({ task, startsHere: plan.length === 0 });
    usedMinutes += taskMinutes;
  }

  return plan;
}
