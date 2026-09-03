import { and, asc, eq, inArray, isNull, lt, notInArray } from 'drizzle-orm';
import { db } from '@/shared/db';
import { tasks } from '@/shared/db/schema';
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
  insertPredictionsIfAbsent,
  getPredictionsForDate,
  saveCheckinAlphaDelta,
  type PredictionRow,
} from './energy.queries';
import {
  predictLevelForSlot,
  buildVerificationLoop,
  type VerificationLoop,
} from './energy.prediction';
import { buildBudgetPlan, buildEnergyPlan } from './energy.planner';
import type { EnergyPlanResult } from './energy.planner';
import type { Chronotype, SleepQuality } from './energy.utils';
import type { CheckinSlot, CreateCheckinInput, UpdateAccuracyInput } from './energy.schemas';
import { userToday as getTodayDate, calendarDayInTz } from '@/shared/time';
import { getUserTimezone } from '@/shared/time/user-timezone';
import { detectTopPattern } from './energy.advisor';
import type { AdvisorPattern } from './energy.advisor';
import type { Transport } from '@/shared/api/transport';
import {
  computeEffectiveEnergy,
  computeImportance,
  computeCapacity,
  computeLearnedCurve,
  emptyAccuracyBySlot,
  findPeakRange,
  buildPeakAdvice,
  completionWeight,
  sessionWeight,
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


/**
 * Ventana de mayor energía aprendida, en horas locales. Versión ligera de lo que
 * `getLearningInsight` calcula de paso: la usa el arquetipo Writing para decir
 * "tu mejor ventana creativa es 9–11" sin arrastrar snapshots ni check-ins.
 * Null mientras no haya curva aprendida — nunca se inventa una ventana.
 */
export async function getPeakWindow(
  userId: string,
): Promise<{ start: number; end: number } | null> {
  const learned = await getLearnedCurve(userId);
  if (!learned?.curve || learned.curve.length !== 24) return null;
  return findPeakRange(learned.curve);
}

const ALL_SLOTS: readonly CheckinSlot[] = ['morning', 'afternoon', 'evening'];

/**
 * Registra la predicción del día para los slots que aún no tienen check-in
 * (Fase 4.2). Se llama al leer el día y antes de guardar un check-in.
 *
 * La garantía de honestidad está en el filtro: **nunca** se escribe la predicción
 * de un slot que ya tiene resultado. Así la fila guardada siempre viene de un
 * modelo que no conocía la respuesta, que es lo que hace verificable el loop.
 * Sin curva aprendida se predice desde el cronotipo con alpha 0: Kino predice
 * desde el día uno y lo dice.
 */
export async function ensureTodayPredictions(userId: string): Promise<void> {
  const profile = await getUserEnergyProfile(userId);
  if (!profile) return;

  const timezone = await getUserTimezone(userId);
  const today = getTodayDate(timezone);

  const [learned, existing, checkins] = await Promise.all([
    getLearnedCurve(userId),
    getPredictionsForDate(userId, today),
    getCheckinsForDate(userId, today),
  ]);

  const hasLearned = learned?.curve.length === 24;
  const curve = hasLearned ? learned!.curve : CHRONOTYPE_CURVES[profile.chronotype as Chronotype];
  const alpha = hasLearned ? learned!.alpha : 0;

  const settled = new Set<string>([
    ...existing.map((p) => p.slot),
    ...checkins.map((c) => c.slot),
  ]);
  const pending = ALL_SLOTS.filter((slot) => !settled.has(slot));
  if (pending.length === 0) return;

  await insertPredictionsIfAbsent(
    userId,
    today,
    pending.map((slot) => ({
      slot,
      predictedLevel: predictLevelForSlot(curve, slot),
      alphaAtPrediction: alpha,
    })),
  );
}

export async function createTodayCheckin(userId: string, input: CreateCheckinInput) {
  const timezone = await getUserTimezone(userId);
  const today = getTodayDate(timezone);
  const slot = input.slot ?? getSlotForHour(getCurrentHourInTz(timezone));

  // La predicción se cierra antes de aceptar el dato: si el usuario llegó por un
  // camino que no leyó el día (MCP, API), esta es la última oportunidad de dejar
  // constancia de lo que el modelo esperaba sin conocer todavía la respuesta.
  await ensureTodayPredictions(userId);

  const alphaBefore = (await getLearnedCurve(userId))?.alpha ?? 0;
  const row = await upsertCheckin(userId, today, slot, input);

  // Recalibrar aquí —y no solo en el cron— es lo que permite mostrar la mejora
  // atribuible a ESTE check-in en el momento de registrarlo.
  await calibrateLearnedCurve(userId);
  const alphaAfter = (await getLearnedCurve(userId))?.alpha ?? alphaBefore;
  await saveCheckinAlphaDelta(userId, today, slot, alphaBefore, alphaAfter);

  return row;
}

/**
 * El loop del día: la predicción guardada frente al check-in que la verificó, con
 * la mejora del modelo atribuible a ese dato. Toma el check-in más reciente que
 * tenga predicción; `null` si todavía no hay ninguno que verificar.
 */
export async function getVerificationLoop(userId: string): Promise<VerificationLoop | null> {
  const timezone = await getUserTimezone(userId);
  const today = getTodayDate(timezone);

  const [checkins, predictions] = await Promise.all([
    getCheckinsForDate(userId, today),
    getPredictionsForDate(userId, today),
  ]);
  if (checkins.length === 0 || predictions.length === 0) return null;

  const bySlot = new Map(predictions.map((p) => [p.slot, p]));

  // getCheckinsForDate viene en orden ascendente por createdAt → el más reciente primero.
  for (const checkin of [...checkins].reverse()) {
    const prediction = bySlot.get(checkin.slot as CheckinSlot);
    if (!prediction) continue;

    return buildVerificationLoop({
      slot: checkin.slot as CheckinSlot,
      predictedLevel: prediction.predictedLevel,
      reportedLevel: checkin.currentLevel,
      alphaAtPrediction: prediction.alphaAtPrediction,
      alphaBefore: checkin.alphaBefore,
      alphaAfter: checkin.alphaAfter,
      userVerdict: checkin.predictionAccuracy as 'accurate' | 'partial' | 'inaccurate' | null,
    });
  }

  return null;
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

/** El mismo check-in tal como lo recibe la tarjeta del dashboard. */
export type TodayCheckinRowTransport = Transport<TodayCheckinRow>;

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
  /** Predicciones guardadas de hoy, por slot: lo que Kino dijo antes de saber (4.2). */
  predictions: PredictionRow[];
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
  const yesterday = calendarDayInTz(new Date(Date.now() - 86_400_000), timezone);
  const existing = await getSnapshotByDate(userId, yesterday);
  if (!existing) {
    await computeAndSaveBehaviorSnapshot(userId, yesterday);
  }
}

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
    activityWeight[clampHour(completedHour)] += completionWeight(energyLevel);
  }
  for (const { startedHour, energyLevel, source } of timerLogs) {
    activityWeight[clampHour(startedHour)] += sessionWeight(source, energyLevel);
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
  /** El ciclo de hoy: predije X, confirmaste Y, el modelo mejoró Z (null si no hay qué verificar) */
  loop: VerificationLoop | null;
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
    loop: null,
  };

  const profile = await getUserEnergyProfile(userId);
  if (!profile) return base;

  const timezone = await getUserTimezone(userId);
  const [learned, snapshots, checkinRows, loop] = await Promise.all([
    getLearnedCurve(userId),
    getRecentSnapshots(userId, 30),
    getRecentCheckinInsight(userId, 30),
    getVerificationLoop(userId),
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
    loop,
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
  const todayStr = getTodayDate(timezone);
  const today = new Date(todayStr);

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
        lt(tasks.dueDate, todayStr),
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
    return { energyPlan: null, noProfile: true, hasCheckin: false, checkin: null, checkins: [], chronotype: null, learnedCurve: null, learningAlpha: 0, projectedCurve: [], predictions: [] };
  }

  const timezone = await getUserTimezone(userId);
  const todayStr = getTodayDate(timezone);

  // Leer el día es el momento natural para cerrar la predicción: se escribe antes
  // de que exista el check-in que la va a verificar.
  await ensureTodayPredictions(userId);

  const [candidateTasks, checkinRow, allCheckins, learned, predictions] = await Promise.all([
    getPlanCandidateTasks(userId),
    getCheckinByDate(userId, todayStr),
    getCheckinsForDate(userId, todayStr),
    getLearnedCurve(userId),
    getPredictionsForDate(userId, todayStr),
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
    predictions,
  };
}
