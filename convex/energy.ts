import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { detectTopPattern, type AdvisorPattern } from '../src/features/energy/energy.advisor';
import { computeEnergyBudget, energyPointsFor } from '../src/features/energy/energy.budget';
import { buildBudgetPlan, buildEnergyPlan, type DeferralReason } from '../src/features/energy/energy.planner';
import { buildVerificationLoop, predictLevelForSlot, SLOT_HOUR_RANGES } from '../src/features/energy/energy.prediction';
import { buildWeeklyRitual, nextDays, weekdayOf, type RitualDay } from '../src/features/energy/energy.ritual';
import {
  buildPeakAdvice,
  CHRONOTYPE_CURVES,
  completionWeight,
  computeCapacity,
  computeEffectiveEnergy,
  computeImportance,
  computeLearnedCurve,
  emptyAccuracyBySlot,
  findPeakRange,
  formatHourRange,
  sessionWeight,
  type Chronotype,
  type SleepQuality,
} from '../src/features/energy/energy.utils';
import { PAYLOAD_MAX_BYTES, recordEvent } from './eventLog';
import { invalid, notFound } from './lib/errors';
import { kinoZodMutation, kinoZodQuery } from './lib/fn';
import { toTaskRow } from './lib/tasks/row';
import { deriveStatusFromDate } from './lib/tasks/status';
import { calendarDayInTz, userToday } from './lib/time';
import { defaultSettings } from './settings';
import { ownTask, updateTaskDoc } from './tasks';

// La energía: check-ins, predicción verificable, curva aprendida, presupuesto
// del día, bloques y el ritual semanal. Lo que razona vive puro en
// `src/features/energy/*`; aquí se reúnen los datos y se escriben los hechos.

type Ctx = QueryCtx | MutationCtx;
type Slot = 'morning' | 'afternoon' | 'evening';
const ALL_SLOTS: readonly Slot[] = ['morning', 'afternoon', 'evening'];
const DAY_MS = 86_400_000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const iso = (ms: number) => new Date(ms).toISOString();

function slotForHour(hour: number): Slot {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

export function currentHourIn(timezone: string, now = Date.now()): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now)) % 24;
}

// ── Lecturas compartidas ────────────────────────────────────────────────────

async function profileOf(ctx: Ctx, userId: Id<'users'>) {
  return ctx.db.query('userEnergyProfile').withIndex('by_user', (q) => q.eq('userId', userId)).unique();
}

async function settingsOf(ctx: Ctx, user: Doc<'users'>) {
  const row = await ctx.db.query('userSettings').withIndex('by_user', (q) => q.eq('userId', user._id)).unique();
  return {
    timezone: user.timezone,
    dailyEnergyLimit: row?.dailyEnergyLimit ?? 50,
    weeklyReviewDay: row?.weeklyReviewDay ?? ('sun' as const),
  };
}

/** Todas las tareas vivas del usuario como filas, para los módulos puros. */
async function aliveRows(ctx: Ctx, userId: Id<'users'>) {
  const docs = await ctx.db
    .query('tasks')
    .withIndex('by_user_alive_status', (q) => q.eq('userId', userId).eq('deletedAt', undefined))
    .collect();
  return docs.map(toTaskRow);
}

const ACTIVE = new Set(['today', 'tomorrow', 'week']);

async function checkinsOn(ctx: Ctx, userId: Id<'users'>, date: string) {
  const rows = await ctx.db.query('energyCheckins').withIndex('by_user_day_slot', (q) => q.eq('userId', userId).eq('date', date)).collect();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

async function predictionsOn(ctx: Ctx, userId: Id<'users'>, date: string) {
  const rows = await ctx.db.query('energyPredictions').withIndex('by_user_day_slot', (q) => q.eq('userId', userId).eq('date', date)).collect();
  return rows.map((row) => ({ slot: row.slot, predictedLevel: row.predictedLevel, alphaAtPrediction: row.alphaAtPrediction }));
}

async function recentSnapshots(ctx: Ctx, userId: Id<'users'>, days: number) {
  const rows = await ctx.db.query('behaviorSnapshots').withIndex('by_user_day', (q) => q.eq('userId', userId)).collect();
  return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, days);
}

function learnedOf(profile: Doc<'userEnergyProfile'>) {
  return profile.learnedCurve.length === 24 ? { curve: profile.learnedCurve, alpha: profile.learningAlpha } : null;
}

function checkinItem(row: Doc<'energyCheckins'>) {
  return {
    id: row._id,
    date: row.date,
    slot: row.slot,
    currentLevel: row.currentLevel,
    sleepQuality: row.sleepQuality,
    predictionAccuracy: row.predictionAccuracy ?? null,
    alphaBefore: row.alphaBefore ?? null,
    alphaAfter: row.alphaAfter ?? null,
    createdAt: iso(row.createdAt),
  };
}

function snapshotItem(row: Doc<'behaviorSnapshots'>) {
  return {
    date: row.date,
    tasksCreated: row.tasksCreated,
    tasksCompleted: row.tasksCompleted,
    tasksOverdue: row.tasksOverdue,
    criticalCount: row.criticalCount,
    activeCount: row.activeCount,
    completionRate: row.completionRate,
    learningAlpha: row.learningAlpha,
    updatedAt: new Date(row.updatedAt),
  };
}

// ── Predicción y calibración ────────────────────────────────────────────────

/**
 * Registra la predicción del día para los slots sin check-in. Nunca reescribe
 * la de un slot que ya tiene resultado: así la fila guardada siempre viene de
 * un modelo que no conocía la respuesta.
 */
async function ensurePredictions(ctx: MutationCtx, user: Doc<'users'>, profile: Doc<'userEnergyProfile'>, now: number) {
  const today = userToday(user.timezone, now);
  const [existing, checkins] = await Promise.all([predictionsOn(ctx, user._id, today), checkinsOn(ctx, user._id, today)]);
  const learned = learnedOf(profile);
  const curve = learned?.curve ?? CHRONOTYPE_CURVES[profile.chronotype];
  const settled = new Set<string>([...existing.map((p) => p.slot), ...checkins.map((c) => c.slot)]);
  for (const slot of ALL_SLOTS) {
    if (settled.has(slot)) continue;
    await ctx.db.insert('energyPredictions', {
      userId: user._id,
      date: today,
      slot,
      predictedLevel: predictLevelForSlot(curve, slot),
      alphaAtPrediction: learned?.alpha ?? 0,
      createdAt: now,
    });
  }
}

export const ensureTodayPredictions = kinoZodMutation({
  args: {},
  handler: async (ctx) => {
    const profile = await profileOf(ctx, ctx.user._id);
    if (profile) await ensurePredictions(ctx, ctx.user, profile, Date.now());
    return null;
  },
});

/** Recalibra la curva aprendida con los últimos 90 días de señales. */
async function calibrate(ctx: MutationCtx, user: Doc<'users'>, profile: Doc<'userEnergyProfile'>, now: number) {
  const cutoff = now - 90 * DAY_MS;
  const tz = user.timezone;
  const hourOf = (ms: number) => currentHourIn(tz, ms);

  const tasks = await aliveRows(ctx, user._id);
  const activityWeight = new Array<number>(24).fill(0);
  for (const task of tasks) {
    if (task.completedAt && task.completedAt.getTime() >= cutoff) {
      activityWeight[hourOf(task.completedAt.getTime())] += completionWeight(task.energyLevel);
    }
  }
  const logs = (await ctx.db.query('timeLogs').withIndex('by_user_started', (q) => q.eq('userId', user._id).gte('startedAt', cutoff)).collect()).filter(
    (log) => log.source === 'timer' || log.source === 'writing',
  );
  for (const log of logs) {
    const task = log.taskId ? await ctx.db.get(log.taskId) : null;
    activityWeight[hourOf(log.startedAt)] += sessionWeight(log.source as 'timer' | 'writing', task?.energyLevel ?? null);
  }

  const checkinLevelSum = new Array<number>(24).fill(0);
  const checkinCount = new Array<number>(24).fill(0);
  const accuracyBySlot = emptyAccuracyBySlot();
  const checkins = (await ctx.db.query('energyCheckins').withIndex('by_user_day_slot', (q) => q.eq('userId', user._id)).collect()).filter(
    (c) => c.createdAt >= cutoff,
  );
  for (const c of checkins) {
    const h = hourOf(c.createdAt);
    checkinLevelSum[h] += c.currentLevel;
    checkinCount[h] += 1;
    if (c.predictionAccuracy) accuracyBySlot[c.slot][c.predictionAccuracy] += 1;
  }

  const result = computeLearnedCurve(profile.chronotype, { activityWeight, checkinLevelSum, checkinCount, accuracyBySlot });
  if (!result) return;
  await ctx.db.patch(profile._id, { learnedCurve: result.curve, learningAlpha: result.alpha, updatedAt: now });
}

export const calibrateLearnedCurve = kinoZodMutation({
  args: {},
  handler: async (ctx) => {
    const profile = await profileOf(ctx, ctx.user._id);
    if (profile) await calibrate(ctx, ctx.user, profile, Date.now());
    return null;
  },
});

// ── Check-ins ───────────────────────────────────────────────────────────────

export const checkins = kinoZodQuery({
  args: {},
  handler: async (ctx) => (await checkinsOn(ctx, ctx.user._id, userToday(ctx.user.timezone))).map(checkinItem),
});

/**
 * Guarda el check-in del slot y recalibra en el acto, para poder mostrar la
 * mejora del modelo atribuible a este dato.
 */
export const createCheckin = kinoZodMutation({
  args: {
    currentLevel: z.number().int().min(1).max(100),
    sleepQuality: z.enum(['good', 'partial', 'poor']).default('partial'),
    slot: z.enum(['morning', 'afternoon', 'evening']).optional(),
  },
  handler: async (ctx, input) => {
    const user = ctx.user;
    const profile = await profileOf(ctx, user._id);
    const now = Date.now();
    const today = userToday(user.timezone, now);
    const slot = input.slot ?? slotForHour(currentHourIn(user.timezone, now));
    if (profile) await ensurePredictions(ctx, user, profile, now);

    const alphaBefore = profile ? (learnedOf(profile)?.alpha ?? 0) : 0;
    const existing = (await checkinsOn(ctx, user._id, today)).find((c) => c.slot === slot);
    let id: Id<'energyCheckins'>;
    if (existing) {
      await ctx.db.patch(existing._id, { currentLevel: input.currentLevel, sleepQuality: input.sleepQuality });
      id = existing._id;
    } else {
      id = await ctx.db.insert('energyCheckins', {
        userId: user._id,
        date: today,
        slot,
        currentLevel: input.currentLevel,
        sleepQuality: input.sleepQuality,
        createdAt: now,
      });
    }
    if (profile) {
      await calibrate(ctx, user, profile, now);
      const after = await profileOf(ctx, user._id);
      await ctx.db.patch(id, { alphaBefore, alphaAfter: after ? (learnedOf(after)?.alpha ?? alphaBefore) : alphaBefore });
    }
    return checkinItem((await ctx.db.get(id))!);
  },
});

export const updateAccuracy = kinoZodMutation({
  args: {
    accuracy: z.enum(['accurate', 'partial', 'inaccurate']),
    slot: z.enum(['morning', 'afternoon', 'evening']).optional(),
  },
  handler: async (ctx, input) => {
    const today = userToday(ctx.user.timezone);
    const slot = input.slot ?? slotForHour(currentHourIn(ctx.user.timezone));
    const row = (await checkinsOn(ctx, ctx.user._id, today)).find((c) => c.slot === slot);
    if (!row) notFound('Checkin not found');
    await ctx.db.patch(row._id, { predictionAccuracy: input.accuracy });
    return checkinItem((await ctx.db.get(row._id))!);
  },
});

// ── El plan de hoy ──────────────────────────────────────────────────────────

/**
 * El plan de energía del día. Quien lo pinta llama antes a
 * `ensureTodayPredictions`, que es la escritura que cierra la predicción.
 */
export const todayPlan = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;
    const profile = await profileOf(ctx, user._id);
    if (!profile) {
      return { energyPlan: null, noProfile: true, hasCheckin: false, checkin: null, checkins: [], chronotype: null, learnedCurve: null, learningAlpha: 0, projectedCurve: [], predictions: [] };
    }
    const today = userToday(user.timezone);
    const [rows, all, predictions] = await Promise.all([aliveRows(ctx, user._id), checkinsOn(ctx, user._id, today), predictionsOn(ctx, user._id, today)]);
    const candidates = rows.filter((t) => ACTIVE.has(t.status));
    const latest = all[all.length - 1];
    const checkin = latest ? { currentLevel: latest.currentLevel, sleepQuality: latest.sleepQuality } : null;
    const learned = learnedOf(profile);
    const baseCurve = learned?.curve ?? CHRONOTYPE_CURVES[profile.chronotype];
    const projectedCurve = baseCurve.map((_, h) => Math.round(computeCapacity(h, profile.chronotype, checkin?.sleepQuality ?? 'partial', baseCurve)));
    const energyPlan = checkin
      ? buildEnergyPlan({
          tasks: candidates,
          availableHoursPerDay: profile.availableHoursPerDay,
          chronotype: profile.chronotype,
          sleepQuality: checkin.sleepQuality,
          energyFloor: profile.energyFloor,
          today: new Date(today),
          learnedCurve: learned?.curve,
        })
      : null;
    return {
      energyPlan,
      noProfile: false,
      hasCheckin: checkin !== null,
      checkin,
      checkins: all.map((c) => ({ id: c._id, slot: c.slot, currentLevel: c.currentLevel, sleepQuality: c.sleepQuality, predictionAccuracy: c.predictionAccuracy ?? null, createdAt: iso(c.createdAt) })),
      chronotype: profile.chronotype,
      learnedCurve: learned?.curve ?? null,
      learningAlpha: profile.learningAlpha,
      projectedCurve,
      predictions,
    };
  },
});

/** El plan por presupuesto de horas, sin curva: lo que ve quien no hizo check-in. */
export const budgetPlan = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const profile = await profileOf(ctx, ctx.user._id);
    if (!profile) return { plan: [], noProfile: true };
    const candidates = (await aliveRows(ctx, ctx.user._id)).filter((t) => ACTIVE.has(t.status));
    return { plan: buildBudgetPlan(candidates, profile.availableHoursPerDay, new Date(userToday(ctx.user.timezone))), noProfile: false };
  },
});

// ── "Kino te conoce" ────────────────────────────────────────────────────────

async function verificationLoop(ctx: Ctx, user: Doc<'users'>) {
  const today = userToday(user.timezone);
  const [all, predictions] = await Promise.all([checkinsOn(ctx, user._id, today), predictionsOn(ctx, user._id, today)]);
  const bySlot = new Map(predictions.map((p) => [p.slot, p]));
  for (const checkin of [...all].reverse()) {
    const prediction = bySlot.get(checkin.slot);
    if (!prediction) continue;
    return buildVerificationLoop({
      slot: checkin.slot,
      predictedLevel: prediction.predictedLevel,
      reportedLevel: checkin.currentLevel,
      alphaAtPrediction: prediction.alphaAtPrediction,
      alphaBefore: checkin.alphaBefore ?? null,
      alphaAfter: checkin.alphaAfter ?? null,
      userVerdict: checkin.predictionAccuracy ?? null,
    });
  }
  return null;
}

export const learningInsight = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;
    const base = {
      hasCurve: false,
      peak: null as { start: number; end: number } | null,
      advice: { text: '', tone: 'after' as const },
      personalizationPct: 0,
      trend: 'flat' as 'up' | 'flat' | 'down',
      trendDelta: 0,
      sparkline: [] as number[],
      correlationFactor: null as number | null,
      accuracy: null as { rate: number; sample: number } | null,
      chronotype: null as Chronotype | null,
      loop: null as Awaited<ReturnType<typeof verificationLoop>>,
    };
    const profile = await profileOf(ctx, user._id);
    if (!profile) return base;

    const since = calendarDayInTz(Date.now() - 30 * DAY_MS, user.timezone);
    const [snapshots, checkinRows, loop] = await Promise.all([
      recentSnapshots(ctx, user._id, 30),
      (await ctx.db.query('energyCheckins').withIndex('by_user_day_slot', (q) => q.eq('userId', user._id).gte('date', since)).collect()),
      verificationLoop(ctx, user),
    ]);
    const learned = learnedOf(profile);
    const peak = learned ? findPeakRange(learned.curve) : null;
    const personalizationPct = Math.round((learned?.alpha ?? 0) * 100);
    const sparkline = [...snapshots].reverse().slice(-7).map((s) => Math.round(s.learningAlpha * 100));
    const pastPct = sparkline.length > 0 ? sparkline[0]! : personalizationPct;
    const trendDelta = personalizationPct - pastPct;

    const checkinDates = new Set(checkinRows.map((r) => r.date));
    const withCheckin = snapshots.filter((s) => checkinDates.has(s.date));
    const withoutCheckin = snapshots.filter((s) => !checkinDates.has(s.date));
    const historyDays = snapshots.filter((s) => s.tasksCompleted > 0 || checkinDates.has(s.date)).length;
    let correlationFactor: number | null = null;
    if (historyDays >= 14 && withCheckin.length > 0 && withoutCheckin.length > 0) {
      const avg = (rows: typeof snapshots) => rows.reduce((sum, r) => sum + r.tasksCompleted, 0) / rows.length;
      const [avgWith, avgWithout] = [avg(withCheckin), avg(withoutCheckin)];
      if (avgWithout > 0 && avgWith > avgWithout) correlationFactor = Math.round((avgWith / avgWithout) * 10) / 10;
    }
    const acc = { accurate: 0, partial: 0, inaccurate: 0 };
    for (const r of checkinRows) if (r.predictionAccuracy) acc[r.predictionAccuracy] += 1;
    const sample = acc.accurate + acc.partial + acc.inaccurate;

    return {
      hasCurve: learned !== null,
      peak,
      advice: buildPeakAdvice(peak, currentHourIn(user.timezone)),
      personalizationPct,
      trend: trendDelta > 1 ? ('up' as const) : trendDelta < -1 ? ('down' as const) : ('flat' as const),
      trendDelta,
      sparkline,
      correlationFactor,
      accuracy: sample > 0 ? { rate: Math.round(((acc.accurate + 0.5 * acc.partial) / sample) * 100), sample } : null,
      chronotype: profile.chronotype,
      loop,
    };
  },
});

// ── Snapshots de comportamiento ─────────────────────────────────────────────

/** Calcula y guarda el snapshot de un día en la zona del usuario. */
export async function saveBehaviorSnapshot(ctx: MutationCtx, user: Doc<'users'>, date: string) {
  const rows = await aliveRows(ctx, user._id);
  const day = (d: Date | null) => (d ? calendarDayInTz(d.getTime(), user.timezone) : null);
  const tasksCreated = rows.filter((t) => day(t.createdAt) === date).length;
  const tasksCompleted = rows.filter((t) => day(t.completedAt) === date).length;
  const tasksOverdue = rows.filter((t) => t.parentTaskId === null && t.status !== 'done' && t.dueDate !== null && t.dueDate < date).length;
  const criticalCount = rows.filter((t) => t.priority === 'critical' && ACTIVE.has(t.status)).length;
  const activeCount = rows.filter((t) => ACTIVE.has(t.status)).length;
  const profile = await profileOf(ctx, user._id);
  const data = {
    tasksCreated,
    tasksCompleted,
    tasksOverdue,
    criticalCount,
    activeCount,
    completionRate: tasksCompleted / Math.max(1, activeCount + tasksCompleted),
    learningAlpha: profile?.learningAlpha ?? 0,
  };
  const now = Date.now();
  const existing = await ctx.db.query('behaviorSnapshots').withIndex('by_user_day', (q) => q.eq('userId', user._id).eq('date', date)).unique();
  if (existing) await ctx.db.patch(existing._id, { ...data, updatedAt: now });
  else await ctx.db.insert('behaviorSnapshots', { userId: user._id, date, ...data, updatedAt: now });
}

/** El snapshot de ayer, si todavía no existe. Lo llama quien pinta el consejo. */
export const ensureYesterdaySnapshot = kinoZodMutation({
  args: {},
  handler: async (ctx) => {
    const yesterday = calendarDayInTz(Date.now() - DAY_MS, ctx.user.timezone);
    const existing = await ctx.db.query('behaviorSnapshots').withIndex('by_user_day', (q) => q.eq('userId', ctx.user._id).eq('date', yesterday)).unique();
    if (!existing) await saveBehaviorSnapshot(ctx, ctx.user, yesterday);
    return null;
  },
});

/**
 * Lo que el cron diario hace por cada persona activa: el snapshot de ayer si
 * falta y la recalibración de la curva con las señales de los últimos 90 días.
 */
export async function nightlyRefresh(ctx: MutationCtx, user: Doc<'users'>, now = Date.now()) {
  const yesterday = calendarDayInTz(now - DAY_MS, user.timezone);
  const existing = await ctx.db.query('behaviorSnapshots').withIndex('by_user_day', (q) => q.eq('userId', user._id).eq('date', yesterday)).unique();
  if (!existing) await saveBehaviorSnapshot(ctx, user, yesterday);
  const profile = await profileOf(ctx, user._id);
  if (profile) await calibrate(ctx, user, profile, now);
}

// ── El consejo del día ──────────────────────────────────────────────────────

export type AdvisorBulkAction = 'move-tomorrow' | 'move-today' | 'lower-priority' | 'none';

async function advisorAction(ctx: Ctx, user: Doc<'users'>, patternId: AdvisorPattern['id']) {
  const todayStr = userToday(user.timezone);
  const today = new Date(todayStr);
  const rows = (await aliveRows(ctx, user._id)).filter((t) => t.parentTaskId === null);
  const plural = (n: number) => (n !== 1 ? 's' : '');
  if (patternId === 'overload') {
    const ids = rows
      .filter((t) => t.status === 'today')
      .slice(0, 20)
      .sort((a, b) => computeImportance(a, today) - computeImportance(b, today))
      .slice(0, 3)
      .map((t) => t.id);
    return { actionTaskIds: ids, actionLabel: `Mover ${ids.length} tarea${plural(ids.length)} a mañana`, bulkAction: 'move-tomorrow' as const };
  }
  if (patternId === 'abandonment') {
    const overdue = rows
      .filter((t) => t.dueDate !== null && t.dueDate < todayStr && !['done', 'today'].includes(t.status))
      .sort((a, b) => (a.estimatedTime ?? '99').localeCompare(b.estimatedTime ?? '99'))
      .slice(0, 1);
    return { actionTaskIds: overdue.map((t) => t.id), actionLabel: 'Poner la más pequeña en hoy', bulkAction: 'move-today' as const };
  }
  if (patternId === 'disorganization') {
    const ids = rows
      .filter((t) => t.priority === 'critical' && ACTIVE.has(t.status))
      .slice(0, 20)
      .sort((a, b) => computeImportance(b, today) - computeImportance(a, today))
      .slice(2)
      .map((t) => t.id);
    if (ids.length === 0) return { actionTaskIds: [], actionLabel: '', bulkAction: 'none' as const };
    return { actionTaskIds: ids, actionLabel: `Bajar prioridad a ${ids.length} tarea${plural(ids.length)}`, bulkAction: 'lower-priority' as const };
  }
  return { actionTaskIds: [] as string[], actionLabel: '', bulkAction: 'none' as const };
}

export async function todayAdvisor(ctx: Ctx, user: Doc<'users'>) {
  const profile = await profileOf(ctx, user._id);
  if (!profile) return null;
  const recent = (await recentSnapshots(ctx, user._id, 7)).map(snapshotItem);
  if (recent.length === 0) return null;
  const [today, ...rest] = recent;
  const pattern = detectTopPattern(today!, rest, profile.availableHoursPerDay);
  if (!pattern) return null;
  return { ...pattern, ...(await advisorAction(ctx, user, pattern.id)) };
}

export const advisor = kinoZodQuery({
  args: {},
  handler: async (ctx) => todayAdvisor(ctx, ctx.user),
});

// ── Ventanas y bloques ──────────────────────────────────────────────────────

async function committedToday(ctx: Ctx, userId: Id<'users'>) {
  return (await aliveRows(ctx, userId)).filter((t) => t.inTodayPlan && t.parentTaskId === null).map((t) => ({ energyLevel: t.energyLevel, status: t.status }));
}

export const windows = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;
    const profile = await profileOf(ctx, user._id);
    if (!profile) notFound('Energy profile not found');
    const { timezone, dailyEnergyLimit } = await settingsOf(ctx, user);
    const today = userToday(timezone);
    const [predictions, committed] = await Promise.all([predictionsOn(ctx, user._id, today), committedToday(ctx, user._id)]);
    const learned = learnedOf(profile);
    const curve = learned?.curve ?? CHRONOTYPE_CURVES[profile.chronotype];
    const peakRange = learned ? findPeakRange(curve) : null;
    const predictedBySlot = new Map(predictions.map((p) => [p.slot, p.predictedLevel]));
    return {
      chronotype: profile.chronotype,
      hasLearnedCurve: learned !== null,
      personalizationPct: Math.round((learned?.alpha ?? 0) * 100),
      peak: peakRange ? { ...peakRange, label: formatHourRange(peakRange.start, peakRange.end) } : null,
      slots: ALL_SLOTS.map((slot) => {
        const hours = SLOT_HOUR_RANGES[slot];
        const startHour = hours[0]!;
        const endHour = hours[hours.length - 1]! + 1;
        return { slot, label: formatHourRange(startHour, endHour), startHour, endHour, averageCapacity: predictLevelForSlot(curve, slot), predictedToday: predictedBySlot.get(slot) ?? null };
      }),
      availableHoursPerDay: profile.availableHoursPerDay,
      budget: computeEnergyBudget(committed, dailyEnergyLimit),
      timezone,
      today,
    };
  },
});

const DEFERRAL_EXPLANATION: Record<DeferralReason, string> = {
  budget: 'No cabe en las horas disponibles del día.',
  energy: 'Pide más energía de la que la curva proyecta a esa hora.',
};

function minutesOf(estimatedTime: string | null): number {
  if (!estimatedTime) return 30;
  const [h, m] = estimatedTime.split(':');
  return parseInt(h ?? '0', 10) * 60 + parseInt(m ?? '0', 10);
}

function rationaleFor(energyLevel: string | null, hour: number, energy: number): string {
  const when = formatHourRange(hour, hour + 1);
  if (energyLevel === 'high') return `Exige mucho: va en ${when}, donde tu energía proyectada es ${energy}.`;
  if (energyLevel === 'low') return `Pide poco: aprovecha ${when} sin gastar tu mejor tramo.`;
  return `Encaja en ${when} con energía proyectada ${energy}.`;
}

/** Propuesta de bloques para un día, sin escribir nada: el agente propone. */
export const blockProposal = kinoZodQuery({
  args: { date: z.string().regex(DAY_PATTERN).optional(), startHour: z.number().int().min(0).max(23).optional() },
  handler: async (ctx, { date, startHour = 9 }) => {
    const user = ctx.user;
    const profile = await profileOf(ctx, user._id);
    if (!profile) notFound('Energy profile not found');
    const { timezone, dailyEnergyLimit } = await settingsOf(ctx, user);
    const targetDate = date ?? userToday(timezone);
    const rows = await aliveRows(ctx, user._id);
    const learned = learnedOf(profile);
    const plan = buildEnergyPlan({
      tasks: rows.filter((t) => ACTIVE.has(t.status)),
      availableHoursPerDay: profile.availableHoursPerDay,
      chronotype: profile.chronotype,
      sleepQuality: 'partial',
      energyFloor: profile.energyFloor,
      startHour,
      today: new Date(targetDate),
      learnedCurve: learned?.curve,
    });
    const budget = computeEnergyBudget(await committedToday(ctx, user._id), dailyEnergyLimit);
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
      deferred: plan.deferred.map((d) => ({ taskId: d.task.id, title: d.task.title, reason: d.reason, explanation: DEFERRAL_EXPLANATION[d.reason] })),
      totalBreakMinutes: plan.totalBreakMinutes,
      budget,
      overdraftNotice: budget.state === 'over' ? `El día ya está en sobregiro: ${budget.committed}/${budget.limit} pts de energía comprometida.` : null,
    };
  },
});

/** Medianoche local de un día más una hora, como instante. */
function zonedHourToMs(day: string, hour: number, timezone: string): number {
  const guess = Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
  const wall = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess);
  const get = (type: string) => Number(wall.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return guess - (asUtc - guess);
}

/** Coloca o mueve el bloque de una tarea en un día y hora locales. */
export const scheduleBlock = kinoZodMutation({
  args: { taskId: zid('tasks'), date: z.string().regex(DAY_PATTERN), hour: z.number().int().min(0).max(23) },
  handler: async (ctx, { taskId, date, hour }) => {
    const user = ctx.user;
    const profile = await profileOf(ctx, user._id);
    const { timezone, dailyEnergyLimit } = await settingsOf(ctx, user);
    const startsAt = zonedHourToMs(date, hour, timezone);
    const task = await updateTaskDoc(ctx, user, taskId, { startDate: new Date(startsAt).toISOString() });
    const chronotype = profile?.chronotype ?? 'intermediate';
    const learned = profile ? learnedOf(profile) : null;
    const curve = learned?.curve ?? CHRONOTYPE_CURVES[chronotype];
    const effectiveEnergy = Math.round(computeEffectiveEnergy(hour, 0, chronotype, 'partial', profile?.energyFloor ?? 20, curve));
    const demand = task.energyLevel;
    const required = demand === 'high' ? 60 : demand === 'medium' ? 35 : 20;
    const verdict = effectiveEnergy >= required ? 'good' : effectiveEnergy >= required * 0.75 ? 'tight' : 'poor';
    const budget = computeEnergyBudget(await committedToday(ctx, user._id), dailyEnergyLimit);
    return {
      taskId: task._id,
      title: task.title,
      startsAt: new Date(startsAt).toISOString(),
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
      overdraftNotice: budget.state === 'over' ? `Con esto el día queda en ${budget.committed}/${budget.limit} pts (+${budget.overBy}). Nada bloqueado, solo un aviso.` : null,
    };
  },
});

/** Saca la tarea del calendario sin tocar su fecha límite. */
export const clearBlock = kinoZodMutation({
  args: { taskId: zid('tasks') },
  handler: async (ctx, { taskId }) => {
    const existing = await ownTask(ctx, ctx.user._id, taskId);
    if (existing.taskType === 'event') invalid('Un evento necesita fecha de inicio: muévelo de hora en vez de sacarlo del calendario');
    const task = await updateTaskDoc(ctx, ctx.user, taskId, { startDate: null });
    return { id: task._id, startDate: null };
  },
});

// ── Ritual semanal ──────────────────────────────────────────────────────────

export const weeklyRitual = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;
    const { timezone, dailyEnergyLimit, weeklyReviewDay } = await settingsOf(ctx, user);
    const today = userToday(timezone);
    const days = nextDays(today, 7);
    const rows = (await aliveRows(ctx, user._id)).filter((t) => t.parentTaskId === null);
    const overdue = rows.filter((t) => t.dueDate !== null && t.dueDate < today && t.status !== 'done');
    const loadByDay = new Map<string, number>();
    for (const t of rows) {
      if (!t.startDate || t.status === 'done') continue;
      const day = calendarDayInTz(Date.parse(t.startDate), timezone);
      if (day >= today && day <= days[days.length - 1]!) loadByDay.set(day, (loadByDay.get(day) ?? 0) + energyPointsFor(t.energyLevel));
    }
    const ritualDays: RitualDay[] = days.map((date) => {
      const committedPoints = loadByDay.get(date) ?? 0;
      return { date, weekday: weekdayOf(date), committedPoints, remainingPoints: Math.max(0, dailyEnergyLimit - committedPoints) };
    });
    return buildWeeklyRitual({
      reviewDay: weeklyReviewDay,
      todayWeekday: weekdayOf(today),
      today,
      timezone,
      dailyLimit: dailyEnergyLimit,
      overdue,
      days: ritualDays,
      committedToday: rows.filter((t) => t.inTodayPlan).map((t) => ({ energyLevel: t.energyLevel, status: t.status })),
    });
  },
});

/**
 * Reprograma cada tarea a la medianoche local de su día. La fecha límite no se
 * toca.
 *
 * No pasa por `updateTaskDoc`, y eso es la mitad del ticket del presupuesto:
 * ese camino resuelve el sistema, valida el `kind`, comprueba el padre, revisa
 * las referencias, relematiza y sincroniza recordatorios, y con cien
 * asignaciones eso son entre cuatrocientas y ochocientas idas y vueltas a la
 * base en una sola invocación. Aquí sólo se mueve `startDate`, así que la
 * validación que hace falta es la de propiedad: se leen las cien tareas de
 * golpe y se escribe el parche mínimo.
 *
 * **Deja un evento, no cien.** El deshacer campo a campo necesita una fila por
 * cambio, y el reparto semanal no la puede dar sin volver al bucle. La salida
 * es un evento de tipo inverso: guarda en su `payload` la lista de ids con su
 * fecha anterior, y deshacerlo es reponerlas todas, no revertir un campo.
 */
export const applyWeeklyRitual = kinoZodMutation({
  args: { assignments: z.array(z.object({ taskId: zid('tasks'), date: z.string().regex(DAY_PATTERN) })).min(1).max(100) },
  handler: async (ctx, { assignments }) => {
    const userId = ctx.user._id;
    const timezone = ctx.user.timezone;
    const now = Date.now();

    const docs = await Promise.all(assignments.map(({ taskId }) => ctx.db.get(taskId)));

    const applied: Array<{ taskId: string; date: string }> = [];
    const failed: Array<{ taskId: string; message: string }> = [];
    const anterior: Array<{ taskId: string; startDate: string | null }> = [];

    for (const [i, { taskId, date }] of assignments.entries()) {
      const doc = docs[i];
      if (!doc || doc.userId !== userId || doc.deletedAt !== undefined) {
        failed.push({ taskId, message: 'Task not found' });
        continue;
      }
      const startDate = zonedHourToMs(date, 0, timezone);
      const status = doc.status === 'done' ? doc.status : deriveStatusFromDate(startDate, timezone);
      anterior.push({ taskId, startDate: doc.startDate === undefined ? null : new Date(doc.startDate).toISOString() });
      await ctx.db.patch(doc._id, { startDate, status, updatedAt: now });
      applied.push({ taskId, date });
    }

    if (applied.length > 0) {
      // El payload va acotado a 2.048 bytes y ahí no caben cien fechas
      // anteriores. `boundPayload` sustituiría el objeto entero y el evento
      // perdería también la cuenta, así que la comprobación se hace aquí: el
      // reparto grande deja constancia de cuántas movió, el pequeño deja
      // además con qué reponerlas.
      const completo = { reprogramadas: applied.length, anterior };
      const cabe = new TextEncoder().encode(JSON.stringify(completo)).byteLength <= PAYLOAD_MAX_BYTES;
      await recordEvent(ctx, {
        userId,
        actorChannel: ctx.channel,
        action: 'energy.applyWeeklyRitual',
        targetType: 'task',
        targetId: applied[0]!.taskId,
        payload: cabe ? completo : { reprogramadas: applied.length, anteriorOmitido: true },
      });
    }

    return { applied, failed };
  },
});

/** Perfil de energía inicial del onboarding. */
export async function createEnergyProfile(
  ctx: MutationCtx,
  userId: Id<'users'>,
  input: { chronotype: Chronotype; sleepTypicalHours: number; availableHoursPerDay: number; rechargePresets: Array<Record<string, unknown>> },
) {
  const now = Date.now();
  const existing = await profileOf(ctx, userId);
  if (existing) return existing._id;
  await ctx.db.query('userSettings').withIndex('by_user', (q) => q.eq('userId', userId)).unique().then(async (row) => {
    if (!row) await ctx.db.insert('userSettings', defaultSettings(userId, now));
  });
  return ctx.db.insert('userEnergyProfile', {
    userId,
    chronotype: input.chronotype,
    sleepTypicalHours: input.sleepTypicalHours,
    availableHoursPerDay: input.availableHoursPerDay,
    energyFloor: 20,
    rechargePresets: input.rechargePresets,
    learnedCurve: [],
    learningAlpha: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export type { SleepQuality };

/** Los últimos siete días: instantáneas de conducta y check-ins, para las tendencias del dashboard. */
export const weeklyTrends = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const user = ctx.user;
    const now = Date.now();
    const days = Array.from({ length: 7 }, (_, i) => userToday(user.timezone, now - i * 86_400_000));
    const oldest = days[days.length - 1]!;
    const snapshots = (
      await ctx.db.query('behaviorSnapshots').withIndex('by_user_day', (q) => q.eq('userId', user._id)).collect()
    )
      .filter((row) => row.date >= oldest)
      .map(snapshotItem);
    const checkins = (await Promise.all(days.map((date) => checkinsOn(ctx, user._id, date)))).flat().map(checkinItem);
    return { snapshots, checkins };
  },
});
