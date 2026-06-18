import { db } from "@/shared/db";
import { sprints } from "@/shared/db/schema";
import { and, eq, max } from "drizzle-orm";
import type { CreateSprintInput, UpdateSprintInput } from "./sprints.schemas";
import type { Sprint } from "./sprints.types";

export async function getSprintsBySystem(
  systemId: string,
  userId: string,
): Promise<Sprint[]> {
  return db
    .select()
    .from(sprints)
    .where(and(eq(sprints.systemId, systemId), eq(sprints.userId, userId)))
    .orderBy(sprints.sortOrder);
}

export async function createSprint(
  userId: string,
  input: CreateSprintInput,
): Promise<Sprint> {
  const [{ maxOrder }] = await db
    .select({ maxOrder: max(sprints.sortOrder) })
    .from(sprints)
    .where(and(eq(sprints.systemId, input.systemId), eq(sprints.userId, userId)));

  const [created] = await db
    .insert(sprints)
    .values({
      userId,
      systemId: input.systemId,
      name: input.name,
      goal: input.goal,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      sortOrder: (maxOrder ?? -1) + 1,
    })
    .returning();

  return created!;
}

export async function updateSprint(
  sprintId: string,
  userId: string,
  data: UpdateSprintInput,
): Promise<Sprint | null> {
  const patch: Partial<typeof sprints.$inferInsert> = { updatedAt: new Date() };
  if (data.name !== undefined) patch.name = data.name;
  if (data.goal !== undefined) patch.goal = data.goal;
  if (data.startDate !== undefined)
    patch.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.endDate !== undefined)
    patch.endDate = data.endDate ? new Date(data.endDate) : null;
  if (data.status !== undefined) {
    patch.status = data.status;
    patch.completedAt = data.status === "completed" ? new Date() : null;
  }

  const [updated] = await db
    .update(sprints)
    .set(patch)
    .where(and(eq(sprints.id, sprintId), eq(sprints.userId, userId)))
    .returning();

  return updated ?? null;
}

/** Cierra el sprint: lo marca completado y archiva la iteración. Las tarjetas
 * conservan su sprint_id y se ven agrupadas bajo él en la pestaña Archivadas. */
export async function closeSprint(
  sprintId: string,
  userId: string,
): Promise<Sprint | null> {
  const [updated] = await db
    .update(sprints)
    .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sprints.id, sprintId), eq(sprints.userId, userId)))
    .returning();

  return updated ?? null;
}

export async function deleteSprint(
  sprintId: string,
  userId: string,
): Promise<boolean> {
  // tasks.sprint_id queda en null por la FK (ON DELETE SET NULL).
  const [deleted] = await db
    .delete(sprints)
    .where(and(eq(sprints.id, sprintId), eq(sprints.userId, userId)))
    .returning({ id: sprints.id });

  return !!deleted;
}
