import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, notInArray, sql } from 'drizzle-orm';
import { db } from '@/shared/db';
import { behaviorSnapshots, energyCheckins, energyPredictions, tasks, timeLogs, userEnergyProfile } from '@/shared/db/schema';
import type { CheckinSlot, CreateCheckinInput } from './energy.schemas';

// ── behavior_snapshots ─────────────────────────────────────────────────────

export interface SnapshotData {
  tasksCreated: number;
  tasksCompleted: number;
  tasksOverdue: number;
  criticalCount: number;
  activeCount: number;
  completionRate: number;
  learningAlpha: number;
}

export async function upsertBehaviorSnapshot(userId: string, date: string, data: SnapshotData) {
  const [row] = await db
    .insert(behaviorSnapshots)
    .values({ userId, date, ...data })
    .onConflictDoUpdate({
      target: [behaviorSnapshots.userId, behaviorSnapshots.date],
      set: { ...data, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function getSnapshotByDate(userId: string, date: string) {
  const [row] = await db
    .select()
    .from(behaviorSnapshots)
    .where(and(eq(behaviorSnapshots.userId, userId), eq(behaviorSnapshots.date, date)))
    .limit(1);
  return row ?? null;
}

export async function getRecentSnapshots(userId: string, days: number) {
  return db
    .select()
    .from(behaviorSnapshots)
    .where(eq(behaviorSnapshots.userId, userId))
    .orderBy(desc(behaviorSnapshots.date))
    .limit(days);
}

export async function getRecentCheckins(userId: string, days: number) {
  return db
    .select()
    .from(energyCheckins)
    .where(eq(energyCheckins.userId, userId))
    .orderBy(desc(energyCheckins.date))
    .limit(days);
}

// Conteos para computar un snapshot de una fecha dada (en la zona del usuario)
export async function countSnapshotMetrics(userId: string, date: string, timezone: string) {
  const [created, completed, overdue, critical, active] = await Promise.all([
    // Tareas creadas ese día en la zona del usuario
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          sql`DATE(${tasks.createdAt} AT TIME ZONE ${timezone}) = ${date}::date`,
          isNull(tasks.deletedAt),
        ),
      ),
    // Tareas completadas ese día
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          sql`DATE(${tasks.completedAt} AT TIME ZONE ${timezone}) = ${date}::date`,
          isNull(tasks.deletedAt),
        ),
      ),
    // Tareas vencidas a esa fecha
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          lt(tasks.dueDate, date),
          notInArray(tasks.status, ['done', 'archived']),
          isNull(tasks.deletedAt),
        ),
      ),
    // Tareas críticas activas
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.priority, 'critical'),
          inArray(tasks.status, ['today', 'tomorrow', 'week']),
          isNull(tasks.deletedAt),
        ),
      ),
    // Tareas activas totales
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          inArray(tasks.status, ['today', 'tomorrow', 'week']),
          isNull(tasks.deletedAt),
        ),
      ),
  ]);

  const tasksCreated = created[0]?.count ?? 0;
  const tasksCompleted = completed[0]?.count ?? 0;
  const tasksOverdue = overdue[0]?.count ?? 0;
  const criticalCount = critical[0]?.count ?? 0;
  const activeCount = active[0]?.count ?? 0;
  const completionRate = tasksCompleted / Math.max(1, activeCount + tasksCompleted);

  return { tasksCreated, tasksCompleted, tasksOverdue, criticalCount, activeCount, completionRate };
}

export async function upsertCheckin(userId: string, date: string, slot: CheckinSlot, input: Omit<CreateCheckinInput, 'slot'>) {
  const [row] = await db
    .insert(energyCheckins)
    .values({
      userId,
      date,
      slot,
      currentLevel: input.currentLevel,
      sleepQuality: input.sleepQuality,
    })
    .onConflictDoUpdate({
      target: [energyCheckins.userId, energyCheckins.date, energyCheckins.slot],
      set: {
        currentLevel: input.currentLevel,
        ...(input.sleepQuality !== undefined && { sleepQuality: input.sleepQuality }),
      },
    })
    .returning();
  return row;
}

export async function getCheckinByDate(userId: string, date: string) {
  const [row] = await db
    .select()
    .from(energyCheckins)
    .where(and(eq(energyCheckins.userId, userId), eq(energyCheckins.date, date)))
    .orderBy(desc(energyCheckins.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getCheckinsForDate(userId: string, date: string) {
  return db
    .select()
    .from(energyCheckins)
    .where(and(eq(energyCheckins.userId, userId), eq(energyCheckins.date, date)))
    .orderBy(asc(energyCheckins.createdAt));
}

export async function updateCheckinAccuracy(
  userId: string,
  date: string,
  slot: CheckinSlot,
  accuracy: 'accurate' | 'partial' | 'inaccurate',
) {
  const [row] = await db
    .update(energyCheckins)
    .set({ predictionAccuracy: accuracy })
    .where(
      and(
        eq(energyCheckins.userId, userId),
        eq(energyCheckins.date, date),
        eq(energyCheckins.slot, slot),
      ),
    )
    .returning();
  return row ?? null;
}

export async function getPlanCandidateTasks(userId: string) {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        inArray(tasks.status, ['today', 'tomorrow', 'week']),
        isNull(tasks.deletedAt),
      ),
    );
}

/**
 * Tareas comprometidas al plan de hoy, con lo mínimo que el presupuesto necesita.
 * Incluye las completadas: el presupuesto mide compromiso, no producción.
 */
export async function getCommittedTodayTasks(
  userId: string,
): Promise<Array<{ energyLevel: string | null; status: string }>> {
  const rows = await db
    .select({ energyLevel: tasks.energyLevel, status: tasks.status })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.inTodayPlan, true),
        isNull(tasks.deletedAt),
        isNull(tasks.parentTaskId),
      ),
    );

  return rows;
}

export async function getUserEnergyProfile(userId: string) {
  const [row] = await db
    .select()
    .from(userEnergyProfile)
    .where(eq(userEnergyProfile.userId, userId))
    .limit(1);
  return row ?? null;
}

// ── Calibración de curva aprendida ─────────────────────────────────────────

export async function getCompletedTasksLast90Days(
  userId: string,
  timezone: string,
): Promise<Array<{ completedHour: number; energyLevel: string }>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const rows = await db
    .select({
      completedHour: sql<number>`EXTRACT(HOUR FROM ${tasks.completedAt} AT TIME ZONE ${timezone})::int`,
      energyLevel: tasks.energyLevel,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        isNotNull(tasks.completedAt),
        isNull(tasks.deletedAt),
        gte(tasks.completedAt, cutoff),
      ),
    );

  return rows as Array<{ completedHour: number; energyLevel: string }>;
}

export interface TimeLogSignalRow {
  startedHour: number;
  /** Null en las sesiones de escritura: un capítulo no declara nivel de energía. */
  energyLevel: string | null;
  source: 'timer' | 'writing';
}

/**
 * Sesiones de trabajo de los últimos 90 días para calibrar la curva.
 *
 * Incluye las sesiones de escritura (W4), no solo los timers de tareas: son horas
 * de trabajo profundo reales y el arquetipo Writing muestra su "ventana creativa"
 * derivada justo de esta curva. Con el `innerJoin` a tasks que había antes,
 * escribir tres horas diarias no movía la ventana que Kino le enseña al escritor.
 * De ahí el leftJoin: las filas de escritura no tienen tarea.
 */
export function startedTimeLogsLast90DaysQuery(userId: string, timezone: string, cutoff: Date) {
  return db
    .select({
      startedHour: sql<number>`EXTRACT(HOUR FROM ${timeLogs.startedAt} AT TIME ZONE ${timezone})::int`,
      energyLevel: tasks.energyLevel,
      source: timeLogs.source,
    })
    .from(timeLogs)
    .leftJoin(tasks, eq(timeLogs.taskId, tasks.id))
    .where(
      and(
        eq(timeLogs.userId, userId),
        inArray(timeLogs.source, ['timer', 'writing']),
        gte(timeLogs.startedAt, cutoff),
      ),
    );
}

export async function getStartedTimeLogsLast90Days(
  userId: string,
  timezone: string,
): Promise<TimeLogSignalRow[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const rows = await startedTimeLogsLast90DaysQuery(userId, timezone, cutoff);
  return rows as TimeLogSignalRow[];
}

export interface CheckinSignalRow {
  hour: number;
  currentLevel: number;
  slot: CheckinSlot;
  predictionAccuracy: 'accurate' | 'partial' | 'inaccurate' | null;
}

export async function getCheckinsLast90Days(
  userId: string,
  timezone: string,
): Promise<CheckinSignalRow[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const rows = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${energyCheckins.createdAt} AT TIME ZONE ${timezone})::int`,
      currentLevel: energyCheckins.currentLevel,
      slot: energyCheckins.slot,
      predictionAccuracy: energyCheckins.predictionAccuracy,
    })
    .from(energyCheckins)
    .where(
      and(
        eq(energyCheckins.userId, userId),
        gte(energyCheckins.createdAt, cutoff),
      ),
    );

  return rows as CheckinSignalRow[];
}

export interface CheckinInsightRow {
  date: string;
  predictionAccuracy: 'accurate' | 'partial' | 'inaccurate' | null;
}

/** Check-ins de los últimos N días (fecha + precisión) para correlación y accuracy. */
export async function getRecentCheckinInsight(
  userId: string,
  sinceDays: number,
): Promise<CheckinInsightRow[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - sinceDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select({
      date: energyCheckins.date,
      predictionAccuracy: energyCheckins.predictionAccuracy,
    })
    .from(energyCheckins)
    .where(and(eq(energyCheckins.userId, userId), gte(energyCheckins.date, cutoffStr)));

  return rows as CheckinInsightRow[];
}

// ── energy_predictions ─────────────────────────────────────────────────────

export interface PredictionRow {
  slot: CheckinSlot;
  predictedLevel: number;
  alphaAtPrediction: number;
}

/**
 * Registra la predicción de un slot si no existe. `onConflictDoNothing` es la
 * garantía central del loop: la primera predicción del día es la que se verifica,
 * y ninguna lectura posterior la reescribe con una curva que ya aprendió del dato.
 */
export async function insertPredictionsIfAbsent(
  userId: string,
  date: string,
  predictions: Array<{ slot: CheckinSlot; predictedLevel: number; alphaAtPrediction: number }>,
): Promise<void> {
  if (predictions.length === 0) return;

  await db
    .insert(energyPredictions)
    .values(predictions.map((p) => ({ userId, date, ...p })))
    .onConflictDoNothing({
      target: [energyPredictions.userId, energyPredictions.date, energyPredictions.slot],
    });
}

export async function getPredictionsForDate(userId: string, date: string): Promise<PredictionRow[]> {
  const rows = await db
    .select({
      slot: energyPredictions.slot,
      predictedLevel: energyPredictions.predictedLevel,
      alphaAtPrediction: energyPredictions.alphaAtPrediction,
    })
    .from(energyPredictions)
    .where(and(eq(energyPredictions.userId, userId), eq(energyPredictions.date, date)));

  return rows as PredictionRow[];
}

/** Guarda el alpha antes/después de que un check-in recalibrara la curva. */
export async function saveCheckinAlphaDelta(
  userId: string,
  date: string,
  slot: CheckinSlot,
  alphaBefore: number,
  alphaAfter: number,
): Promise<void> {
  await db
    .update(energyCheckins)
    .set({ alphaBefore, alphaAfter })
    .where(
      and(
        eq(energyCheckins.userId, userId),
        eq(energyCheckins.date, date),
        eq(energyCheckins.slot, slot),
      ),
    );
}

export async function saveLearnedCurve(
  userId: string,
  curve: number[],
  alpha: number,
): Promise<void> {
  await db
    .update(userEnergyProfile)
    .set({
      learnedCurve: JSON.stringify(curve),
      learningAlpha: alpha,
      updatedAt: new Date(),
    })
    .where(eq(userEnergyProfile.userId, userId));
}

export async function getLearnedCurve(
  userId: string,
): Promise<{ curve: number[]; alpha: number } | null> {
  const [row] = await db
    .select({ learnedCurve: userEnergyProfile.learnedCurve, learningAlpha: userEnergyProfile.learningAlpha })
    .from(userEnergyProfile)
    .where(eq(userEnergyProfile.userId, userId))
    .limit(1);

  if (!row) return null;

  let curve: number[] = [];
  try {
    const parsed = JSON.parse(row.learnedCurve) as unknown;
    if (Array.isArray(parsed) && parsed.length === 24) {
      curve = parsed as number[];
    }
  } catch {
    // malformed JSON — treat as cold-start
  }

  return { curve, alpha: row.learningAlpha };
}
