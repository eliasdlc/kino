import { and, eq, isNull, gte, sql } from 'drizzle-orm';
import { db } from '@/shared/db';
import { tasks, systems, timeLogs } from '@/shared/db/schema';

const ENERGY_POINTS_EXPR = sql<number>`CASE ${tasks.energyLevel}
  WHEN 'high' THEN 5
  WHEN 'medium' THEN 3
  ELSE 1
END`;

export interface SystemEnergyRow {
  systemId: string;
  systemName: string;
  energySpent: number;
  tasksCompleted: number;
}

export async function queryEnergyBySystem(
  userId: string,
  fromDate: Date,
): Promise<SystemEnergyRow[]> {
  const rows = await db
    .select({
      systemId: tasks.systemId,
      systemName: systems.name,
      energySpent: sql<number>`SUM(${ENERGY_POINTS_EXPR})::int`,
      tasksCompleted: sql<number>`COUNT(*)::int`,
    })
    .from(tasks)
    .innerJoin(systems, eq(tasks.systemId, systems.id))
    .where(
      and(
        eq(tasks.userId, userId),
        isNull(tasks.deletedAt),
        gte(tasks.completedAt, fromDate),
        sql`${tasks.completedAt} IS NOT NULL`,
      ),
    )
    .groupBy(tasks.systemId, systems.name);

  return rows as SystemEnergyRow[];
}

export interface StaleSystemRow {
  systemId: string;
  systemName: string;
  daysSinceActivity: number;
}

/** Actividad cruda de un sistema, tal como la produce la SQL. */
export interface SystemActivityRow {
  systemId: string;
  systemName: string;
  createdAt: Date;
  lastCompletedAt: string | null;
  lastLogAt: string | null;
}

const DAY_MS = 86_400_000;

/**
 * Deriva las filas stale desde la actividad cruda. Actividad = lo más reciente
 * entre la última tarea completada y el último time log; un sistema sin
 * actividad se mide contra su antigüedad (`createdAt`), para no marcar como
 * abandonado uno recién creado. Puro y testeable: la SQL solo entrega
 * timestamps, el umbral se aplica aquí.
 */
export function toStaleSystemRows(
  rows: SystemActivityRow[],
  thresholdDays: number,
  now = Date.now(),
): StaleSystemRow[] {
  return rows
    .map((r) => {
      const activity = [r.lastCompletedAt, r.lastLogAt]
        .filter((t): t is string => t !== null)
        .map((t) => new Date(t).getTime());
      const reference = activity.length ? Math.max(...activity) : r.createdAt.getTime();
      const daysSinceActivity = Math.floor((now - reference) / DAY_MS);
      return { systemId: r.systemId, systemName: r.systemName, daysSinceActivity };
    })
    .filter((r) => r.daysSinceActivity >= thresholdDays)
    .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
}

export async function queryInactiveSystems(
  userId: string,
  thresholdDays: number,
): Promise<StaleSystemRow[]> {
  const rows = await db
    .select({
      systemId: systems.id,
      systemName: systems.name,
      createdAt: systems.createdAt,
      lastCompletedAt: sql<string | null>`(
        SELECT MAX(${tasks.completedAt}) FROM ${tasks}
        WHERE ${tasks.systemId} = ${systems.id} AND ${tasks.deletedAt} IS NULL
      )`,
      lastLogAt: sql<string | null>`(
        SELECT MAX(${timeLogs.createdAt}) FROM ${timeLogs}
        WHERE ${timeLogs.systemId} = ${systems.id}
      )`,
    })
    .from(systems)
    .where(and(eq(systems.userId, userId), eq(systems.isActive, true), eq(systems.isInbox, false)));

  return toStaleSystemRows(rows, thresholdDays);
}
