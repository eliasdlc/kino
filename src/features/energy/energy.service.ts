import { and, asc, eq, inArray, isNull, lt, notInArray } from 'drizzle-orm';
import { db } from '@/shared/db';
import { tasks, users } from '@/shared/db/schema';
import {
  upsertCheckin,
  getCheckinByDate,
  getCheckinsForDate,
  updateCheckinAccuracy,
  getPlanCandidateTasks,
  getUserEnergyProfile,
  getSnapshotByDate,
  getRecentSnapshots,
  getRecentCheckins,
  countSnapshotMetrics,
  upsertBehaviorSnapshot,
  getCompletedTasksLast90Days,
  getStartedTimeLogsLast90Days,
  getCheckinsLast90Days,
  getRecentCheckinInsight,
  saveLearnedCurve,
  getLearnedCurve,
} from './energy.queries';
import { buildBudgetPlan, buildEnergyPlan } from './energy.planner';
import type { EnergyPlanResult } from './energy.planner';
import type { Chronotype, SleepQuality } from './energy.utils';
import type { CheckinSlot, CreateCheckinInput, UpdateAccuracyInput } from './energy.schemas';
import { userToday as getTodayDate } from '@/shared/time';
import { detectTopPattern } from './energy.advisor';
import type { AdvisorPattern } from './energy.advisor';
import {
  computeEffectiveEnergy,
  computeImportance,
  computeCapacity,
  computeLearnedCurve,
  emptyAccuracyBySlot,
  findPeakRange,
  buildPeakAdvice,
  CHRONOTYPE_CURVES,
  type PeakAdviceTone,
} from './energy.utils';

function getSlotForHour(hour: number): CheckinSlot {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

export function getCurrentHourInTz(timezone: string): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(new Date()),
    10,
  );
}

async function getUserTimezone(userId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.timezone ?? 'UTC';
}

export async function createTodayCheckin(userId: string, input: CreateCheckinInput) {
  const timezone = await getUserTimezone(userId);
  const today = getTodayDate(timezone);
  const slot = input.slot ?? getSlotForHour(getCurrentHourInTz(timezone));
  return upsertCheckin(userId, today, slot, input);
}

export async function getTodayCheckin(userId: string) {
  const timezone = await getUserTimezone(userId);
  const today = getTodayDate(timezone);
  return getCheckinByDate(userId, today);
}

export async function getTodayCheckins(userId: string) {
  const timezone = await getUserTimezone(userId);
  const today = getTodayDate(timezone);
  return getCheckinsForDate(userId, today);
}

export async function updatePredictionAccuracy(userId: string, input: UpdateAccuracyInput) {
  const timezone = await getUserTimezone(userId);
  const today = getTodayDate(timezone);
  const slot = input.slot ?? getSlotForHour(getCurrentHourInTz(timezone));
  return updateCheckinAccuracy(userId, today, slot, input.accuracy);
}

export async function getTodayPlan(userId: string) {
  const profile = await getUserEnergyProfile(userId);
  if (!profile) return { plan: [], noProfile: true };

  const [candidateTasks, timezone] = await Promise.all([
    getPlanCandidateTasks(userId),
    getUserTimezone(userId),
  ]);

  const today = new Date(getTodayDate(timezone));
  const plan = buildBudgetPlan(candidateTasks, profile.availableHoursPerDay, today);
  return { plan, noProfile: false };
}

export interface TodayCheckinRow {
  id: string;
  slot: CheckinSlot;
  currentLevel: number;
  sleepQuality: SleepQuality;
  predictionAccuracy: 'accurate' | 'partial' | 'inaccurate' | null;
  createdAt: Date;
}

export interface TodayEnergyPlanResult {
  energyPlan: EnergyPlanResult | null;
  noProfile: boolean;
  hasCheckin: boolean;
  checkin: { currentLevel: number; sleepQuality: SleepQuality } | null;
  checkins: TodayCheckinRow[];
  chronotype: Chronotype | null;
  learnedCurve: number[] | null;
  learningAlpha: number;
  /** Curva proyectada para display (24 valores), disponible siempre (con o sin check-in). */
  projectedCurve: number[];
}

// ── Behavior snapshots ─────────────────────────────────────────────────────

export async function computeAndSaveBehaviorSnapshot(userId: string, date: string): Promise<void> {
  const timezone = await getUserTimezone(userId);
  const [metrics, profile] = await Promise.all([
    countSnapshotMetrics(userId, date, timezone),
    getUserEnergyProfile(userId),
  ]);
  await upsertBehaviorSnapshot(userId, date, {
    ...metrics,
    learningAlpha: profile?.learningAlpha ?? 0,
  });
}

export async function ensureYesterdaySnapshot(userId: string): Promise<void> {
  const timezone = await getUserTimezone(userId);
  const yesterday = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() - 86_400_000));
  const existing = await getSnapshotByDate(userId, yesterday);
  if (!existing) {
    await computeAndSaveBehaviorSnapshot(userId, yesterday);
  }
}

const ENERGY_WEIGHTS: Record<string, number> = { high: 3, medium: 2, low: 1 };

const clampHour = (h: number) => Math.max(0, Math.min(23, h));

export async function calibrateLearnedCurve(userId: string): Promise<void> {
  const timezone = await getUserTimezone(userId);

  const [completedTasks, timerLogs, checkins, profile] = await Promise.all([
    getCompletedTasksLast90Days(userId, timezone),
    getStartedTimeLogsLast90Days(userId, timezone),
    getCheckinsLast90Days(userId, timezone),
    getUserEnergyProfile(userId),
  ]);

  if (!profile) return;

  const activityWeight = new Array<number>(24).fill(0);
  for (const { completedHour, energyLevel } of completedTasks) {
    activityWeight[clampHour(completedHour)] += ENERGY_WEIGHTS[energyLevel] ?? 1;
  }
  for (const { startedHour, energyLevel } of timerLogs) {
    activityWeight[clampHour(startedHour)] += (ENERGY_WEIGHTS[energyLevel] ?? 1) * 1.5; // timer es señal más limpia
  }

  const checkinLevelSum = new Array<number>(24).fill(0);
  const checkinCount = new Array<number>(24).fill(0);
  const accuracyBySlot = emptyAccuracyBySlot();
  for (const { hour, currentLevel, slot, predictionAccuracy } of checkins) {
    const h = clampHour(hour);
    checkinLevelSum[h] += currentLevel;
    checkinCount[h] += 1;
    if (predictionAccuracy) accuracyBySlot[slot][predictionAccuracy] += 1;
  }

  const result = computeLearnedCurve(profile.chronotype as Chronotype, {
    activityWeight,
    checkinLevelSum,
    checkinCount,
    accuracyBySlot,
  });
  if (!result) return;

  await saveLearnedCurve(userId, result.curve, result.alpha);
}

export interface WeeklyTrend {
  snapshots: Awaited<ReturnType<typeof getRecentSnapshots>>;
  checkins: Awaited<ReturnType<typeof getRecentCheckins>>;
}

export async function getWeeklyTrends(userId: string): Promise<WeeklyTrend> {
  const [snapshots, checkins] = await Promise.all([
    getRecentSnapshots(userId, 7),
    getRecentCheckins(userId, 7),
  ]);
  return { snapshots, checkins };
}

// ── "Kino te conoce" ─────────────────────────────────────────────────────────

export interface LearningInsight {
  hasCurve: boolean;
  peak: { start: number; end: number } | null;
  advice: { text: string; tone: PeakAdviceTone };
  personalizationPct: number;
  trend: 'up' | 'flat' | 'down';
  trendDelta: number;
  /** % de personalización por día (cronológico, hasta 7 puntos) para el sparkline */
  sparkline: number[];
  /** Veces más tareas en días con check-in (null si <14 días de historial) */
  correlationFactor: number | null;
  /** Precisión de la predicción según tu feedback (null si aún no hay) */
  accuracy: { rate: number; sample: number } | null;
  chronotype: Chronotype | null;
}

export async function getLearningInsight(userId: string): Promise<LearningInsight> {
  const base: LearningInsight = {
    hasCurve: false,
    peak: null,
    advice: { text: '', tone: 'after' },
    personalizationPct: 0,
    trend: 'flat',
    trendDelta: 0,
    sparkline: [],
    correlationFactor: null,
    accuracy: null,
    chronotype: null,
  };

  const profile = await getUserEnergyProfile(userId);
  if (!profile) return base;

  const timezone = await getUserTimezone(userId);
  const [learned, snapshots, checkinRows] = await Promise.all([
    getLearnedCurve(userId),
    getRecentSnapshots(userId, 30),
    getRecentCheckinInsight(userId, 30),
  ]);

  const chronotype = profile.chronotype as Chronotype;
  const curve = learned?.curve && learned.curve.length === 24 ? learned.curve : null;
  const peak = curve ? findPeakRange(curve) : null;
  const advice = buildPeakAdvice(peak, getCurrentHourInTz(timezone));

  const personalizationPct = Math.round((learned?.alpha ?? 0) * 100);

  // Tendencia + sparkline desde el histórico de alpha en snapshots.
  const sparkline = [...snapshots]
    .reverse()
    .slice(-7)
    .map((s) => Math.round(s.learningAlpha * 100));
  const pastPct = sparkline.length > 0 ? sparkline[0]! : personalizationPct;
  const trendDelta = personalizationPct - pastPct;
  const trend = trendDelta > 1 ? 'up' : trendDelta < -1 ? 'down' : 'flat';

  // Correlación: tareas completadas en días con check-in vs sin (guard 14 días).
  const checkinDates = new Set(checkinRows.map((r) => r.date));
  const withCheckin = snapshots.filter((s) => checkinDates.has(s.date));
  const withoutCheckin = snapshots.filter((s) => !checkinDates.has(s.date));
  const historyDays = snapshots.filter(
    (s) => s.tasksCompleted > 0 || checkinDates.has(s.date),
  ).length;

  let correlationFactor: number | null = null;
  if (historyDays >= 14 && withCheckin.length > 0 && withoutCheckin.length > 0) {
    const avg = (rows: typeof snapshots) =>
      rows.reduce((sum, r) => sum + r.tasksCompleted, 0) / rows.length;
    const avgWith = avg(withCheckin);
    const avgWithout = avg(withoutCheckin);
    if (avgWithout > 0 && avgWith > avgWithout) {
      correlationFactor = Math.round((avgWith / avgWithout) * 10) / 10;
    }
  }

  // Precisión de la predicción desde el feedback del usuario.
  const acc = { accurate: 0, partial: 0, inaccurate: 0 };
  for (const r of checkinRows) if (r.predictionAccuracy) acc[r.predictionAccuracy] += 1;
  const sample = acc.accurate + acc.partial + acc.inaccurate;
  const accuracy =
    sample > 0
      ? { rate: Math.round(((acc.accurate + 0.5 * acc.partial) / sample) * 100), sample }
      : null;

  return {
    hasCurve: curve !== null,
    peak,
    advice,
    personalizationPct,
    trend,
    trendDelta,
    sparkline,
    correlationFactor,
    accuracy,
    chronotype,
  };
}

// ── Advisor ────────────────────────────────────────────────────────────────

export type AdvisorBulkAction = 'move-tomorrow' | 'move-today' | 'lower-priority' | 'none';

export interface AdvisorWithAction extends AdvisorPattern {
  actionTaskIds: string[];
  actionLabel: string;
  bulkAction: AdvisorBulkAction;
}

async function resolveAdvisorAction(
  userId: string,
  patternId: AdvisorPattern['id'],
  timezone: string,
): Promise<{ actionTaskIds: string[]; actionLabel: string; bulkAction: AdvisorBulkAction }> {
  const today = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));

  if (patternId === 'overload') {
    const todayTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'today'), isNull(tasks.deletedAt), isNull(tasks.parentTaskId)))
      .limit(20);
    const sorted = todayTasks.sort((a, b) => computeImportance(a, today) - computeImportance(b, today));
    const ids = sorted.slice(0, 3).map((t) => t.id);
    return { actionTaskIds: ids, actionLabel: `Mover ${ids.length} tarea${ids.length !== 1 ? 's' : ''} a mañana`, bulkAction: 'move-tomorrow' };
  }

  if (patternId === 'abandonment') {
    const overdue = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        lt(tasks.dueDate, today.toISOString().slice(0, 10)),
        notInArray(tasks.status, ['done', 'archived', 'today']),
        isNull(tasks.deletedAt),
        isNull(tasks.parentTaskId),
      ))
      .orderBy(asc(tasks.estimatedTime))
      .limit(1);
    const ids = overdue.map((t) => t.id);
    return { actionTaskIds: ids, actionLabel: 'Poner la más pequeña en hoy', bulkAction: 'move-today' };
  }

  if (patternId === 'disorganization') {
    const critical = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.userId, userId),
        eq(tasks.priority, 'critical'),
        inArray(tasks.status, ['today', 'tomorrow', 'week']),
        isNull(tasks.deletedAt),
        isNull(tasks.parentTaskId),
      ))
      .limit(20);
    const sorted = critical.sort((a, b) => computeImportance(b, today) - computeImportance(a, today));
    const ids = sorted.slice(2).map((t) => t.id);
    if (ids.length === 0) return { actionTaskIds: [], actionLabel: '', bulkAction: 'none' };
    return { actionTaskIds: ids, actionLabel: `Bajar prioridad a ${ids.length} tarea${ids.length !== 1 ? 's' : ''}`, bulkAction: 'lower-priority' };
  }

  return { actionTaskIds: [], actionLabel: '', bulkAction: 'none' };
}

export async function getTodayAdvisor(userId: string): Promise<AdvisorWithAction | null> {
  const profile = await getUserEnergyProfile(userId);
  if (!profile) return null;
  await ensureYesterdaySnapshot(userId);
  const recent = await getRecentSnapshots(userId, 7);
  if (recent.length === 0) return null;
  const [today, ...rest] = recent;
  const pattern = detectTopPattern(today!, rest, profile.availableHoursPerDay);
  if (!pattern) return null;

  const timezone = await getUserTimezone(userId);
  const action = await resolveAdvisorAction(userId, pattern.id, timezone);
  return { ...pattern, ...action };
}

// ── Level 1 push triggers ──────────────────────────────────────────────────

export interface Level1Result {
  overloadToday: boolean;
  thresholdCrossing: boolean;
}

export async function checkLevel1Triggers(userId: string): Promise<Level1Result> {
  const none = { overloadToday: false, thresholdCrossing: false };

  const profile = await getUserEnergyProfile(userId);
  if (!profile) return none;

  const timezone = await getUserTimezone(userId);
  const todayStr = getTodayDate(timezone);

  const [checkinRow, snapshot] = await Promise.all([
    getCheckinByDate(userId, todayStr),
    getSnapshotByDate(userId, todayStr),
  ]);

  if (!checkinRow || !snapshot) return none;

  const overloadToday =
    snapshot.activeCount > profile.availableHoursPerDay * 2 ||
    snapshot.criticalCount > 5;

  const currentHour = getCurrentHourInTz(timezone);
  const effectiveEnergy = computeEffectiveEnergy(
    currentHour,
    0,
    profile.chronotype as Chronotype,
    checkinRow.sleepQuality as SleepQuality,
    profile.energyFloor,
  );
  const thresholdCrossing = effectiveEnergy < 30;

  return { overloadToday, thresholdCrossing };
}

export async function getTodayEnergyPlan(userId: string): Promise<TodayEnergyPlanResult> {
  const profile = await getUserEnergyProfile(userId);
  if (!profile) {
    return { energyPlan: null, noProfile: true, hasCheckin: false, checkin: null, checkins: [], chronotype: null, learnedCurve: null, learningAlpha: 0, projectedCurve: [] };
  }

  const timezone = await getUserTimezone(userId);
  const todayStr = getTodayDate(timezone);

  const [candidateTasks, checkinRow, allCheckins, learned] = await Promise.all([
    getPlanCandidateTasks(userId),
    getCheckinByDate(userId, todayStr),
    getCheckinsForDate(userId, todayStr),
    getLearnedCurve(userId),
  ]);

  const today = new Date(todayStr);
  const checkin = checkinRow
    ? { currentLevel: checkinRow.currentLevel, sleepQuality: checkinRow.sleepQuality as SleepQuality }
    : null;

  const learnedCurve = learned?.curve && learned.curve.length === 24 ? learned.curve : null;

  // Curva de display siempre disponible: si hay check-in del día, refleja su sueño;
  // si no, asume sueño 'partial'. Usa la curva aprendida cuando existe.
  const baseCurve = learnedCurve ?? CHRONOTYPE_CURVES[profile.chronotype as Chronotype];
  const displaySleep = checkin?.sleepQuality ?? 'partial';
  const projectedCurve = baseCurve.map((_, h) =>
    Math.round(computeCapacity(h, profile.chronotype as Chronotype, displaySleep, baseCurve)),
  );

  const energyPlan = checkin
    ? buildEnergyPlan({
        tasks: candidateTasks,
        availableHoursPerDay: profile.availableHoursPerDay,
        chronotype: profile.chronotype as Chronotype,
        sleepQuality: checkin.sleepQuality,
        energyFloor: profile.energyFloor,
        today,
        learnedCurve: learnedCurve ?? undefined,
      })
    : null;

  const checkins: TodayCheckinRow[] = allCheckins.map((c) => ({
    id: c.id,
    slot: c.slot as CheckinSlot,
    currentLevel: c.currentLevel,
    sleepQuality: c.sleepQuality as SleepQuality,
    predictionAccuracy: c.predictionAccuracy as 'accurate' | 'partial' | 'inaccurate' | null,
    createdAt: c.createdAt,
  }));

  return {
    energyPlan,
    noProfile: false,
    hasCheckin: checkin !== null,
    checkin,
    checkins,
    chronotype: profile.chronotype as Chronotype,
    learnedCurve,
    learningAlpha: learned?.alpha ?? 0,
    projectedCurve,
  };
}
