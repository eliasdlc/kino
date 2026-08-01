/**
 * Time-blocking consciente de energía (Fase 4.3).
 *
 * Lo que un agente necesita para armar el día: leer las ventanas y el
 * presupuesto, pedir una propuesta de bloques, escribir el bloque y sacarlo.
 *
 * Dos reglas de diseño:
 *
 * 1. **No reimplementa criterio.** La propuesta sale de `buildEnergyPlan` y el
 *    presupuesto de `computeEnergyBudget` — los mismos que ve el usuario en
 *    pantalla. Si el agente y la UI discreparan, una de las dos estaría mintiendo.
 * 2. **Un bloque no es una entidad nueva.** Es una tarea con `startDate` con hora,
 *    exactamente lo que escribe el calendario global al arrastrarla. Se escribe
 *    vía `updateTask`, así que hereda validación, derivación de status y ownership.
 */

import { NotFoundError, ValidationError } from '@/shared/utils/error';
import { getTaskById, updateTask } from '@/features/tasks/tasks.service';
import { userToday, zonedDayHourToUtc } from '@/shared/time';
import { computeEnergyBudget, type EnergyBudget } from './energy.budget';
import { buildEnergyPlan, type DeferralReason } from './energy.planner';
import { predictLevelForSlot, SLOT_HOUR_RANGES } from './energy.prediction';
import {
  getCommittedTodayTasks,
  getLearnedCurve,
  getPlanCandidateTasks,
  getPredictionsForDate,
  getUserEnergyProfile,
} from './energy.queries';
import { getUserSettings } from '@/features/settings/settings.service';
import type { CheckinSlot } from './energy.schemas';
import {
  CHRONOTYPE_CURVES,
  computeEffectiveEnergy,
  findPeakRange,
  formatHourRange,
  type Chronotype,
} from './energy.utils';

const ALL_SLOTS: readonly CheckinSlot[] = ['morning', 'afternoon', 'evening'];

/** Día válido en formato yyyy-MM-dd. */
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface EnergySlotWindow {
  slot: CheckinSlot;
  /** Rango horario local, p. ej. "6–12 AM". */
  label: string;
  startHour: number;
  endHour: number;
  /** Capacidad media de la curva vigente en ese tramo (0–100). */
  averageCapacity: number;
  /** La predicción guardada de hoy para ese slot, si ya se registró. */
  predictedToday: number | null;
}

export interface EnergyWindows {
  chronotype: Chronotype;
  /** false = la curva todavía es la teórica del cronotipo. */
  hasLearnedCurve: boolean;
  personalizationPct: number;
  /** Ventana de 2h de mayor capacidad; null si aún no hay curva aprendida. */
  peak: { start: number; end: number; label: string } | null;
  slots: EnergySlotWindow[];
  availableHoursPerDay: number;
  /** Presupuesto de energía de hoy, el mismo que ve el usuario. */
  budget: EnergyBudget;
  timezone: string;
  today: string;
}

/**
 * Ventanas de energía + presupuesto del día. El punto de entrada de lectura para
 * un agente: con esto sabe cuándo colocar lo difícil y cuánto queda del día.
 *
 * El pico se devuelve `null` mientras no haya curva aprendida — prometer "tu mejor
 * ventana es 9–11" sin datos es el tipo de consejo que se deja de leer.
 */
export async function getEnergyWindows(userId: string): Promise<EnergyWindows | null> {
  const profile = await getUserEnergyProfile(userId);
  if (!profile) return null;

  // getUserSettings trae límite y timezone en una lectura: los dos se necesitan.
  const { timezone, dailyEnergyLimit } = await getUserSettings(userId);
  const today = userToday(timezone);

  const [learned, predictions, committed] = await Promise.all([
    getLearnedCurve(userId),
    getPredictionsForDate(userId, today),
    getCommittedTodayTasks(userId),
  ]);

  const chronotype = profile.chronotype as Chronotype;
  const hasLearnedCurve = learned?.curve.length === 24;
  const curve = hasLearnedCurve ? learned!.curve : CHRONOTYPE_CURVES[chronotype];
  const peakRange = hasLearnedCurve ? findPeakRange(curve) : null;

  const predictedBySlot = new Map(predictions.map((p) => [p.slot, p.predictedLevel]));

  const slots: EnergySlotWindow[] = ALL_SLOTS.map((slot) => {
    const hours = SLOT_HOUR_RANGES[slot];
    const startHour = hours[0]!;
    const endHour = hours[hours.length - 1]! + 1;
    return {
      slot,
      label: formatHourRange(startHour, endHour),
      startHour,
      endHour,
      averageCapacity: predictLevelForSlot(curve, slot),
      predictedToday: predictedBySlot.get(slot) ?? null,
    };
  });

  return {
    chronotype,
    hasLearnedCurve,
    personalizationPct: Math.round((learned?.alpha ?? 0) * 100),
    peak: peakRange
      ? { ...peakRange, label: formatHourRange(peakRange.start, peakRange.end) }
      : null,
    slots,
    availableHoursPerDay: profile.availableHoursPerDay,
    budget: computeEnergyBudget(committed, dailyEnergyLimit),
    timezone,
    today,
  };
}

export interface ProposedBlock {
  taskId: string;
  title: string;
  /** Hora local de inicio (0–23) y minuto dentro de esa hora. */
  hour: number;
  minute: number;
  estimatedMinutes: number;
  energyLevel: string | null;
  /** Energía efectiva prevista al arrancar el bloque (0–100). */
  effectiveEnergyAtStart: number;
  /** El planner sugiere una pausa justo antes. */
  breakBefore: boolean;
  /** Por qué ahí, en una frase que el agente puede repetir al usuario. */
  rationale: string;
}

export interface DayBlockProposal {
  date: string;
  timezone: string;
  /** Hora en que arranca la jornada propuesta. */
  startHour: number;
  blocks: ProposedBlock[];
  deferred: Array<{ taskId: string; title: string; reason: DeferralReason; explanation: string }>;
  totalBreakMinutes: number;
  budget: EnergyBudget;
  /** Advertencia de sobregiro, o null. Avisa; no impide nada. */
  overdraftNotice: string | null;
}

const DEFERRAL_EXPLANATION: Record<DeferralReason, string> = {
  budget: 'No cabe en las horas disponibles del día.',
  energy: 'Pide más energía de la que la curva proyecta a esa hora.',
};

const DEFAULT_START_HOUR = 9;

/**
 * Propuesta de bloques para un día, sin escribir nada.
 *
 * Es deliberadamente una lectura: el agente propone, el usuario (o el agente con
 * permiso explícito) escribe con `scheduleTaskBlock`. Un planificador que escribe
 * de una sola pasada convierte una sugerencia en un hecho.
 */
export async function proposeDayBlocks(
  userId: string,
  date?: string,
  startHour = DEFAULT_START_HOUR,
): Promise<DayBlockProposal | null> {
  const profile = await getUserEnergyProfile(userId);
  if (!profile) return null;

  const { timezone, dailyEnergyLimit } = await getUserSettings(userId);
  const targetDate = date ?? userToday(timezone);
  if (!DAY_PATTERN.test(targetDate)) {
    throw new ValidationError('La fecha debe tener el formato yyyy-MM-dd');
  }

  const [candidates, learned, committed] = await Promise.all([
    getPlanCandidateTasks(userId),
    getLearnedCurve(userId),
    getCommittedTodayTasks(userId),
  ]);

  const learnedCurve = learned?.curve.length === 24 ? learned.curve : undefined;
  const plan = buildEnergyPlan({
    tasks: candidates,
    availableHoursPerDay: profile.availableHoursPerDay,
    chronotype: profile.chronotype as Chronotype,
    // Sin check-in del día no se asume que durmió bien: 'partial' es el mismo
    // supuesto que usa la curva de display, para que agente y UI coincidan.
    sleepQuality: 'partial',
    energyFloor: profile.energyFloor,
    startHour: Math.max(0, Math.min(23, Math.floor(startHour))),
    today: new Date(targetDate),
    learnedCurve,
  });

  const budget = computeEnergyBudget(committed, dailyEnergyLimit);

  return {
    date: targetDate,
    timezone,
    startHour,
    blocks: plan.items.map((item) => {
      const hour = Math.min(23, Math.floor(item.scheduledStartMinute / 60));
      return {
        taskId: item.task.id,
        title: item.task.title,
        hour,
        minute: item.scheduledStartMinute % 60,
        estimatedMinutes: minutesOf(item.task.estimatedTime),
        energyLevel: item.task.energyLevel,
        effectiveEnergyAtStart: Math.round(item.effectiveEnergyAtStart),
        breakBefore: item.breakBefore,
        rationale: rationaleFor(item.task.energyLevel, hour, Math.round(item.effectiveEnergyAtStart)),
      };
    }),
    deferred: plan.deferred.map((d) => ({
      taskId: d.task.id,
      title: d.task.title,
      reason: d.reason,
      explanation: DEFERRAL_EXPLANATION[d.reason],
    })),
    totalBreakMinutes: plan.totalBreakMinutes,
    budget,
    overdraftNotice:
      budget.state === 'over'
        ? `El día ya está en sobregiro: ${budget.committed}/${budget.limit} pts de energía comprometida.`
        : null,
  };
}

function rationaleFor(energyLevel: string | null, hour: number, energy: number): string {
  const when = formatHourRange(hour, hour + 1);
  if (energyLevel === 'high') {
    return `Exige mucho: va en ${when}, donde tu energía proyectada es ${energy}.`;
  }
  if (energyLevel === 'low') {
    return `Pide poco: aprovecha ${when} sin gastar tu mejor tramo.`;
  }
  return `Encaja en ${when} con energía proyectada ${energy}.`;
}

function minutesOf(estimatedTime: string | null | undefined): number {
  if (!estimatedTime) return 30;
  const [h, m] = estimatedTime.split(':');
  return parseInt(h ?? '0', 10) * 60 + parseInt(m ?? '0', 10);
}

export interface ScheduledBlock {
  taskId: string;
  title: string;
  /** Instante guardado en `startDate` (timestamptz). */
  startsAt: string;
  date: string;
  hour: number;
  timezone: string;
  /** Ajuste de la hora elegida a la curva, para que el agente pueda explicarla. */
  fit: {
    effectiveEnergy: number;
    demand: string;
    verdict: 'good' | 'tight' | 'poor';
    note: string;
  };
  budget: EnergyBudget;
  /** Aviso de sobregiro tras colocar el bloque, o null. Nunca bloquea. */
  overdraftNotice: string | null;
}

/**
 * Coloca (o mueve) el bloque de una tarea en un día y hora locales del usuario.
 *
 * Escribe `startDate` vía `updateTask`, el mismo camino del calendario: la tarea
 * cambia de status según la fecha y todas las invariantes siguen valiendo. Si la
 * hora no le conviene a la tarea, se coloca igual y se dice — el usuario manda.
 */
export async function scheduleTaskBlock(
  userId: string,
  taskId: string,
  date: string,
  hour: number,
): Promise<ScheduledBlock> {
  if (!DAY_PATTERN.test(date)) {
    throw new ValidationError('La fecha debe tener el formato yyyy-MM-dd');
  }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new ValidationError('La hora debe ser un entero de 0 a 23');
  }

  const [profile, { timezone, dailyEnergyLimit }] = await Promise.all([
    getUserEnergyProfile(userId),
    getUserSettings(userId),
  ]);
  const startsAt = zonedDayHourToUtc(date, hour, timezone);

  // updateTask valida ownership y deriva el status desde la fecha.
  const task = await updateTask(taskId, userId, { startDate: startsAt.toISOString() });

  const [learned, committed] = await Promise.all([
    getLearnedCurve(userId),
    getCommittedTodayTasks(userId),
  ]);

  const chronotype = (profile?.chronotype as Chronotype) ?? 'intermediate';
  const curve = learned?.curve.length === 24 ? learned.curve : CHRONOTYPE_CURVES[chronotype];
  const effectiveEnergy = Math.round(
    computeEffectiveEnergy(hour, 0, chronotype, 'partial', profile?.energyFloor ?? 20, curve),
  );

  const demand = task.energyLevel ?? 'medium';
  const required = demand === 'high' ? 60 : demand === 'medium' ? 35 : 20;
  const verdict: ScheduledBlock['fit']['verdict'] =
    effectiveEnergy >= required ? 'good' : effectiveEnergy >= required * 0.75 ? 'tight' : 'poor';

  const budget = computeEnergyBudget(committed, dailyEnergyLimit);

  return {
    taskId: task.id,
    title: task.title,
    startsAt: startsAt.toISOString(),
    date,
    hour,
    timezone,
    fit: {
      effectiveEnergy,
      demand,
      verdict,
      note:
        verdict === 'good'
          ? `Tu energía proyectada a esa hora (${effectiveEnergy}) alcanza para una tarea de exigencia ${demand}.`
          : verdict === 'tight'
            ? `Queda justo: energía proyectada ${effectiveEnergy} para una tarea ${demand} que pide ~${required}.`
            : `Esa hora te queda floja para una tarea ${demand}: energía proyectada ${effectiveEnergy} contra ~${required}.`,
    },
    budget,
    overdraftNotice:
      budget.state === 'over'
        ? `Con esto el día queda en ${budget.committed}/${budget.limit} pts (+${budget.overBy}). Nada bloqueado, solo un aviso.`
        : null,
  };
}

/**
 * Saca la tarea del calendario sin tocar su fecha límite: `startDate` es la
 * programación, `dueDate` es el compromiso. Un `event` no puede quedarse sin
 * fecha de inicio, así que ahí se rechaza con un motivo claro.
 */
export async function clearTaskBlock(userId: string, taskId: string) {
  const existing = await getTaskById(taskId, userId);
  if (!existing) throw new NotFoundError('Task not found');

  if (existing.taskType === 'event') {
    throw new ValidationError(
      'Un evento necesita fecha de inicio: muévelo de hora en vez de sacarlo del calendario',
    );
  }

  return updateTask(taskId, userId, { startDate: null });
}
