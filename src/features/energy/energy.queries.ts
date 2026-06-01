import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, notInArray, sql } from 'drizzle-orm';
import { db } from '@/shared/db';
import { behaviorSnapshots, energyCheckins, tasks, timeLogs, userEnergyProfile } from '@/shared/db/schema';
import type { CreateCheckinInput } from './energy.schemas';

// ── behavior_snapshots ─────────────────────────────────────────────────────

export interface SnapshotData {
  tasksCreated: number;
  tasksCompleted: number;
  tasksOverdue: number;
  criticalCount: number;
  activeCount: number;
  completionRate: number;
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

export async function upsertCheckin(userId: string, date: string, input: CreateCheckinInput) {
  const [row] = await db
    .insert(energyCheckins)
    .values({
      userId,
      date,
      currentLevel: input.currentLevel,
      sleepQuality: input.sleepQuality,
    })
    .onConflictDoUpdate({
      target: [energyCheckins.userId, energyCheckins.date],
      set: {
        currentLevel: input.currentLevel,
        sleepQuality: input.sleepQuality,
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
    .limit(1);
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

export async function getStartedTimeLogsLast90Days(
  userId: string,
  timezone: string,
): Promise<Array<{ startedHour: number; energyLevel: string }>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const rows = await db
    .select({
      startedHour: sql<number>`EXTRACT(HOUR FROM ${timeLogs.startedAt} AT TIME ZONE ${timezone})::int`,
      energyLevel: tasks.energyLevel,
    })
    .from(timeLogs)
    .innerJoin(tasks, eq(timeLogs.taskId, tasks.id))
    .where(
      and(
        eq(timeLogs.userId, userId),
        eq(timeLogs.source, 'timer'),
        gte(timeLogs.startedAt, cutoff),
      ),
    );

  return rows as Array<{ startedHour: number; energyLevel: string }>;
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
