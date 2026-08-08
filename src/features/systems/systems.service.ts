import { db } from "@/shared/db";
import { CreateSystemInput, System, SystemWithSignals, UpdateSystemInput } from "./systems.types"
import { systems, tasks, contextTags, timeLogs } from "@/shared/db/schema";
import { and, eq, max, sql } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "@/shared/utils/error";
import { deriveStale } from "./systems.signals";

export async function createInboxForUser(userId: string) {

  await db.insert(systems).values({
    userId,
    name: "Inbox",
    isInbox: true,
    color: "blue",
    icon: "inbox",
    sortOrder: 0,
    templateType: "inbox"
  }).onConflictDoNothing();
}

export async function assertNotInbox(system: System) {
  if (system.isInbox) {
    throw new ForbiddenError("Cannot modify or delete the Inbox system");
  }
}

export async function getUsersSystems(userId: string): Promise<SystemWithSignals[]> {
  const userSystems = await db.select()
    .from(systems)
    .where(
      and(
        eq(systems.userId, userId),
        eq(systems.isActive, true)
      )
    ).orderBy(systems.sortOrder);

  // Una pasada agregada por sistema: última tarea completada + nº de activas.
  const stats = await db
    .select({
      systemId: tasks.systemId,
      lastCompletedAt: sql<string | null>`MAX(${tasks.completedAt}) FILTER (WHERE ${tasks.deletedAt} IS NULL)`,
      activeCount: sql<number>`COUNT(*) FILTER (WHERE ${tasks.deletedAt} IS NULL AND ${tasks.status} NOT IN ('done', 'archived'))`,
    })
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .groupBy(tasks.systemId);

  // El tiempo logueado también es actividad: un sistema donde hoy trabajaste
  // (aunque no completaras nada) no está stale.
  const logStats = await db
    .select({
      systemId: timeLogs.systemId,
      lastLogAt: sql<string | null>`MAX(${timeLogs.createdAt})`,
    })
    .from(timeLogs)
    .where(eq(timeLogs.userId, userId))
    .groupBy(timeLogs.systemId);

  const statsBySystem = new Map(stats.map((s) => [s.systemId, s]));
  const lastLogBySystem = new Map(logStats.map((l) => [l.systemId, l.lastLogAt]));
  const now = Date.now();

  return userSystems.map((system) => {
    const s = statsBySystem.get(system.id);
    const activeTaskCount = Number(s?.activeCount ?? 0);
    const activityTimes = [s?.lastCompletedAt, lastLogBySystem.get(system.id)]
      .filter((t): t is string => Boolean(t))
      .map((t) => new Date(t).getTime());
    const daysSinceLastActivity = activityTimes.length
      ? Math.floor((now - Math.max(...activityTimes)) / 86_400_000)
      : null;
    const stale = system.isInbox
      ? false
      : deriveStale({
          expectedFrequency: system.expectedFrequency,
          activeTaskCount,
          daysSinceLastActivity,
          daysSinceCreated: Math.floor((now - system.createdAt.getTime()) / 86_400_000),
        });
    return { ...system, stale, daysSinceLastActivity, activeTaskCount };
  });
}
export async function createSystem(userId: string, input: CreateSystemInput) {
  const [{ maxOrder }] = await db
    .select({ maxOrder: max(systems.sortOrder) })
    .from(systems)
    .where(eq(systems.userId, userId));

  const [created] = await db.insert(systems).values({
    userId,
    name: input.name,
    color: input.color ?? "blue",
    identityStatement: input.identityStatement,
    templateType: input.templateType ?? "custom",
    energyIdeal: input.energyIdeal ?? "medium",
    icon: input.icon ?? "folder",
    expectedFrequency: input.expectedFrequency ?? "daily",
    triggerContext: input.triggerContext ?? "",
    sortOrder: (maxOrder ?? -1) + 1,
  }).returning();

  // Sistemas `project` nacen con categorías por defecto (bug/feature/chore).
  if (created && created.templateType === "project") {
    await db.insert(contextTags).values([
      { userId, systemId: created.id, title: "Bug", color: "red", isDefault: true },
      { userId, systemId: created.id, title: "Feature", color: "blue", isDefault: true },
      { userId, systemId: created.id, title: "Chore", color: "gray", isDefault: true },
    ]);
  }

  return created ?? null;
}
export async function updateSystem(id: string, userId: string, update: UpdateSystemInput) {
  const [updated] = await db.update(systems).set({ ...update, updatedAt: new Date() }).where(and(eq(systems.id, id), eq(systems.userId, userId))).returning();

  return updated ?? null;
}

export async function getSystemById(id: string, userId: string) {
  const [system] = await db.select()
    .from(systems)
    .where(
      and(
        eq(systems.id, id),
        eq(systems.userId, userId),
        eq(systems.isActive, true),
      )
    );

  return system ?? null;
}

export async function deactivateSystem(id: string, userId: string) {
  const [system] = await db.select().from(systems).where(and(eq(systems.id, id), eq(systems.userId, userId)));

  if (!system) throw new NotFoundError("System not found");
  if (system.isInbox) throw new ForbiddenError("Cannot deactivate Inbox");

  const [updated] = await db
    .update(systems)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(systems.id, system.id), eq(systems.userId, userId)))
    .returning();

  return updated;
}

export async function reorderSystem(userId: string, ids: string[]) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.update(systems)
        .set({ sortOrder: i })
        .where(
          and(
            eq(systems.id, ids[i]),
            eq(systems.userId, userId)
          )
        )
    }
  });
}
