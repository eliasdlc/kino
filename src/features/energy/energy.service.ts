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
  saveLearnedCurve,
  getLearnedCurve,
} from './energy.queries';
import { buildBudgetPlan, buildEnergyPlan } from './energy.planner';
import type { EnergyPlanResult } from './energy.planner';
import type { Chronotype, SleepQuality } from './energy.utils';
import type { CheckinSlot, CreateCheckinInput, UpdateAccuracyInput } from './energy.schemas';
import { detectTopPattern } from './energy.advisor';
import type { AdvisorPattern } from './energy.advisor';
import { computeEffectiveEnergy, computeImportance, CHRONOTYPE_CURVES } from './energy.utils';

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

function getTodayDate(timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
}

// ── Behavior snapshots ─────────────────────────────────────────────────────

export async function computeAndSaveBehaviorSnapshot(userId: string, date: string): Promise<void> {
  const timezone = await getUserTimezone(userId);
  const metrics = await countSnapshotMetrics(userId, date, timezone);
  await upsertBehaviorSnapshot(userId, date, metrics);
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

export async function calibrateLearnedCurve(userId: string): Promise<void> {
  const timezone = await getUserTimezone(userId);

  const [completedTasks, timerLogs, profile] = await Promise.all([
    getCompletedTasksLast90Days(userId, timezone),
    getStartedTimeLogsLast90Days(userId, timezone),
    getUserEnergyProfile(userId),
  ]);

  if (!profile) return;

  const N = completedTasks.length + timerLogs.length;
  if (N === 0) return;

  const rawBuckets = new Array<number>(24).fill(0);

  for (const { completedHour, energyLevel } of completedTasks) {
    const h = Math.max(0, Math.min(23, completedHour));
    rawBuckets[h] += ENERGY_WEIGHTS[energyLevel] ?? 1;
  }
  for (const { startedHour, energyLevel } of timerLogs) {
    const h = Math.max(0, Math.min(23, startedHour));
    rawBuckets[h] += (ENERGY_WEIGHTS[energyLevel] ?? 1) * 1.5; // timer es señal más limpia
  }

  const maxBucket = Math.max(...rawBuckets);
  if (maxBucket === 0) return;

  const empiricalCurve = rawBuckets.map((v) => Math.round((v / maxBucket) * 100 * 10) / 10);

  const alpha = Math.min(N / 100, 0.85);
  const theoreticalCurve = CHRONOTYPE_CURVES[profile.chronotype as Chronotype];

  const learnedCurve = theoreticalCurve.map((theoretical, h) => {
    const empirical = empiricalCurve[h] ?? 0;
    return Math.round(((1 - alpha) * theoretical + alpha * empirical) * 10) / 10;
  });

  await saveLearnedCurve(userId, learnedCurve, alpha);
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
    return { energyPlan: null, noProfile: true, hasCheckin: false, checkin: null, checkins: [], chronotype: null, learnedCurve: null, learningAlpha: 0 };
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
  };
}
