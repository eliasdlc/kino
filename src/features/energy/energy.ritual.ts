/**
 * Ritual de revisión semanal (Fase 4.4).
 *
 * Un flujo, no una página: qué quedó vencido, dónde cabe según la energía que te
 * queda cada día, confirmar en un gesto.
 *
 * Dos decisiones de diseño:
 *
 * 1. **Reparte por presupuesto, no a ciegas.** Cada día tiene el mismo límite de
 *    energía de E1 y una carga ya comprometida (lo que tenga programado). Una
 *    tarea solo cae en un día donde todavía cabe; si no cabe en ninguno, se dice
 *    en vez de amontonarla.
 * 2. **El ritual asigna días, no horas.** Colocar en la hora exacta es trabajo del
 *    time-blocking (E3) y del planner, que ven la curva por hora. Mezclar las dos
 *    cosas haría que el ritual prometa una precisión que no tiene.
 */

import { computeImportance } from './energy.utils';
import { computeEnergyBudget, energyPointsFor, type EnergyBudget } from './energy.budget';
import type { Task } from '@/features/tasks/tasks.types';

/** Día del reparto, con lo que ya tiene comprometido. */
export interface RitualDay {
  /** yyyy-MM-dd en la tz del usuario. */
  date: string;
  /** 'mon' … 'sun': para etiquetar sin recalcular fechas en el cliente. */
  weekday: Weekday;
  /** Puntos de energía ya comprometidos ese día. */
  committedPoints: number;
  /** Cuántos puntos caben todavía. */
  remainingPoints: number;
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEKDAY_ORDER: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

export interface RitualAssignment {
  taskId: string;
  title: string;
  /** Día propuesto (yyyy-MM-dd). */
  date: string;
  weekday: Weekday;
  energyPoints: number;
  /** Por qué ese día, en una frase repetible. */
  rationale: string;
}

export type LeftoverReason = 'no_room' | 'too_big';

export interface RitualLeftover {
  taskId: string;
  title: string;
  energyPoints: number;
  reason: LeftoverReason;
  explanation: string;
}

export interface WeeklyRedistribution {
  assignments: RitualAssignment[];
  leftovers: RitualLeftover[];
  /** Estado de cada día después del reparto propuesto. */
  days: RitualDay[];
}

const LEFTOVER_EXPLANATION: Record<LeftoverReason, string> = {
  no_room: 'Ningún día de la semana tiene presupuesto libre para esta tarea.',
  too_big: 'Pesa más que el presupuesto completo de un día: hay que partirla.',
};

/**
 * Reparte las tareas vencidas entre los días disponibles respetando el presupuesto
 * de energía de cada uno.
 *
 * Función pura: recibe los días con su carga y devuelve el reparto propuesto sin
 * escribir nada. El orden es por importancia (urgencia + prioridad + antigüedad),
 * y cada tarea va al **primer día donde entra**: repartir lo urgente lo más
 * temprano posible es el punto del ritual; balancear la carga a costa de retrasar
 * lo vencido sería resolver el problema contrario.
 */
export function buildWeeklyRedistribution(
  overdue: Task[],
  days: RitualDay[],
  dailyLimit: number,
  today: Date,
): WeeklyRedistribution {
  const working = days.map((d) => ({ ...d }));
  const assignments: RitualAssignment[] = [];
  const leftovers: RitualLeftover[] = [];

  const sorted = [...overdue].sort(
    (a, b) => computeImportance(b, today) - computeImportance(a, today),
  );

  for (const task of sorted) {
    const points = energyPointsFor(task.energyLevel);

    if (dailyLimit > 0 && points > dailyLimit) {
      leftovers.push({
        taskId: task.id,
        title: task.title,
        energyPoints: points,
        reason: 'too_big',
        explanation: LEFTOVER_EXPLANATION.too_big,
      });
      continue;
    }

    const day = working.find((d) => d.remainingPoints >= points);
    if (!day) {
      leftovers.push({
        taskId: task.id,
        title: task.title,
        energyPoints: points,
        reason: 'no_room',
        explanation: LEFTOVER_EXPLANATION.no_room,
      });
      continue;
    }

    day.committedPoints += points;
    day.remainingPoints -= points;

    assignments.push({
      taskId: task.id,
      title: task.title,
      date: day.date,
      weekday: day.weekday,
      energyPoints: points,
      rationale: `${WEEKDAY_LABELS[day.weekday]} tiene ${day.remainingPoints + points} pts libres; esta pesa ${points}.`,
    });
  }

  return { assignments, leftovers, days: working };
}

export interface WeeklyRitual {
  /** Día de revisión elegido por el usuario ('sun' por defecto). */
  reviewDay: Weekday;
  /** Si hoy es ese día. La UI lo usa para ofrecer el ritual sin insistir el resto de la semana. */
  isReviewDay: boolean;
  today: string;
  timezone: string;
  dailyLimit: number;
  overdueCount: number;
  redistribution: WeeklyRedistribution;
  /** Presupuesto de hoy, para que el ritual no contradiga lo que muestra el dashboard. */
  todayBudget: EnergyBudget;
}

/** Construye el estado del ritual a partir de los datos ya leídos. */
export function buildWeeklyRitual(input: {
  reviewDay: Weekday;
  todayWeekday: Weekday;
  today: string;
  timezone: string;
  dailyLimit: number;
  overdue: Task[];
  days: RitualDay[];
  committedToday: Array<{ energyLevel: string | null; status: string }>;
}): WeeklyRitual {
  const { reviewDay, todayWeekday, today, timezone, dailyLimit, overdue, days, committedToday } = input;

  return {
    reviewDay,
    isReviewDay: todayWeekday === reviewDay,
    today,
    timezone,
    dailyLimit,
    overdueCount: overdue.length,
    redistribution: buildWeeklyRedistribution(overdue, days, dailyLimit, new Date(today)),
    todayBudget: computeEnergyBudget(committedToday, dailyLimit),
  };
}

/** Weekday de una fecha yyyy-MM-dd, sin depender de la tz del proceso. */
export function weekdayOf(dateISO: string): Weekday {
  const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
  // getUTCDay sobre una fecha construida en UTC: 0 = domingo.
  const jsDay = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return WEEKDAY_ORDER[(jsDay + 6) % 7]!;
}

/** Los `count` días consecutivos que arrancan en `startISO`, en orden. */
export function nextDays(startISO: string, count: number): string[] {
  const [y, m, d] = startISO.slice(0, 10).split('-').map(Number);
  const base = Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  return Array.from({ length: count }, (_, i) =>
    new Date(base + i * 86_400_000).toISOString().slice(0, 10),
  );
}
