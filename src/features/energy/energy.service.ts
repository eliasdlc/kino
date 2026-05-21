import { and, asc, eq, inArray, isNull, lt, notInArray } from 'drizzle-orm';
import { db } from '@/shared/db';
import { tasks, users } from '@/shared/db/schema';
import {
  upsertCheckin,
  getCheckinByDate,
  getPlanCandidateTasks,
  getUserEnergyProfile,
  getSnapshotByDate,
  getRecentSnapshots,
  getRecentCheckins,
  countSnapshotMetrics,
  upsertBehaviorSnapshot,
} from './energy.queries';
import { buildBudgetPlan, buildEnergyPlan } from './energy.planner';
import type { EnergyPlanResult } from './energy.planner';
import type { Chronotype, SleepQuality } from './energy.utils';
import type { CreateCheckinInput } from './energy.schemas';
import { detectTopPattern } from './energy.advisor';
import type { AdvisorPattern } from './energy.advisor';
import { computeEffectiveEnergy, computeImportance } from './energy.utils';

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
  return upsertCheckin(userId, today, input);
}

export async function getTodayCheckin(userId: string) {
  const timezone = await getUserTimezone(userId);
  const today = getTodayDate(timezone);
  return getCheckinByDate(userId, today);
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

export interface TodayEnergyPlanResult {
  energyPlan: EnergyPlanResult | null;
  noProfile: boolean;
  hasCheckin: boolean;
  checkin: { currentLevel: number; sleepQuality: SleepQuality } | null;
  chronotype: Chronotype | null;
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
        notInArray(tasks.status, ['done', 'archived']),
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

  const currentHour = new Date().getHours();
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
    return { energyPlan: null, noProfile: true, hasCheckin: false, checkin: null, chronotype: null };
  }

  const timezone = await getUserTimezone(userId);
  const todayStr = getTodayDate(timezone);

  const [candidateTasks, checkinRow] = await Promise.all([
    getPlanCandidateTasks(userId),
    getCheckinByDate(userId, todayStr),
  ]);

  const today = new Date(todayStr);
  const checkin = checkinRow
    ? { currentLevel: checkinRow.currentLevel, sleepQuality: checkinRow.sleepQuality as SleepQuality }
    : null;

  const energyPlan = checkin
    ? buildEnergyPlan({
        tasks: candidateTasks,
        availableHoursPerDay: profile.availableHoursPerDay,
        chronotype: profile.chronotype as Chronotype,
        sleepQuality: checkin.sleepQuality,
        energyFloor: profile.energyFloor,
        today,
      })
    : null;

  return {
    energyPlan,
    noProfile: false,
    hasCheckin: checkin !== null,
    checkin,
    chronotype: profile.chronotype as Chronotype,
  };
}
