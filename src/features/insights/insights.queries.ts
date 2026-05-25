import { and, eq, isNull, gte, sql } from 'drizzle-orm';
import { db } from '@/shared/db';
import { tasks, systems } from '@/shared/db/schema';

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
  daysSinceLastTask: number;
}

export async function queryInactiveSystems(
  userId: string,
  thresholdDays: number,
): Promise<StaleSystemRow[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);

  const rows = await db
    .select({
      systemId: systems.id,
      systemName: systems.name,
      lastTaskAt: sql<string | null>`MAX(${tasks.createdAt})`,
    })
    .from(systems)
    .leftJoin(
      tasks,
      and(eq(tasks.systemId, systems.id), isNull(tasks.deletedAt)),
    )
    .where(and(eq(systems.userId, userId), eq(systems.isActive, true), eq(systems.isInbox, false)))
    .groupBy(systems.id, systems.name)
    .having(
      sql`MAX(${tasks.createdAt}) < ${cutoff.toISOString()} OR MAX(${tasks.createdAt}) IS NULL`,
    );

  return rows.map((r) => {
    const lastAt = r.lastTaskAt ? new Date(r.lastTaskAt) : null;
    const daysSince = lastAt
      ? Math.floor((Date.now() - lastAt.getTime()) / 86_400_000)
      : 999;
    return { systemId: r.systemId, systemName: r.systemName, daysSinceLastTask: daysSince };
  });
}
