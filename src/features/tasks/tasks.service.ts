import { db } from "@/shared/db";
import { tasks, taskStatusEnum, users } from "@/shared/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { NotFoundError } from "@/shared/utils/error";
import { validateTransition } from "./tasks.state-machine";
import { Task, CreateTaskInput, UpdateTaskInput } from "./tasks.types";

type TaskStatus = (typeof taskStatusEnum.enumValues)[number];

export async function getTasksBySystem(systemId: string, userId: string) {
  return db.select()
    .from(tasks)
    .where(and(
      eq(tasks.systemId, systemId),
      eq(tasks.userId, userId),
      isNull(tasks.deletedAt)
    ))
    .orderBy(tasks.sortIndex);
}

export async function createTask(userId: string, data: CreateTaskInput) {
  const [task] = await db.insert(tasks)
    .values({ ...data, userId })
    .returning();

  return task ?? null;
}

export async function updateTask(taskId: string, userId: string, data: UpdateTaskInput) {
  const [task] = await db.update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.userId, userId),
        isNull(tasks.deletedAt)));

  return task ?? null;
}

export async function deleteTask(taskId: string, userId: string) {
  const [task] = await db.update(tasks)
    .set({ deletedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .returning();

  if (!task) throw new NotFoundError("Task not found");
  return task;
}

export async function toggleTask(taskId: string, userId: string): Promise<{ status: string, xp_earned?: number }> {
  const [current] = await db.select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)));

  if (!current) throw new NotFoundError("Task not found");

  const isDone = current.status === "done";
  const action = isDone ? "undo_done" : "toggle_done";

  const result = validateTransition({
    currentStatus: current.status,
    action,
    taskEnergyPoints: current.energyPoints,
    currentDayEnergyUsed: 0, // TODO: calcular si necesitas validar energy limit
    dailyEnergyLimit: 50,    // TODO: traer de user_settings
    isRecurring: current.isRecurring,
  });

  if (!result.valid || !result.newStatus) {
    throw new Error(result.error ?? "Invalid transition");
  }

  const updates: Partial<typeof tasks.$inferInsert> = {
    status: result.newStatus,
    updatedAt: new Date()
  };

  let xpDelta = 0;

  for (const effect of result.sideEffects ?? []) {
    switch (effect.type) {
      case "set_completed_at":
        updates.completedAt = effect.value;
        break;
      case "clear_completed_at":
        updates.completedAt = null;
        break;
      case "grant_xp":
        xpDelta = effect.amount;
        break;
      case "revert_xp":
        xpDelta = -effect.amount;
        break;
    }
  }

  await db.transaction(async (tx) => {
    await tx.update(tasks).set(updates)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)));

    if (xpDelta !== 0) {
      await tx.update(users)
        .set({ xpTotal: sql`${users.xpTotal} + ${xpDelta}` })
        .where(eq(users.id, userId));
    }
  });

  return {
    status: result.newStatus,
    xp_earned: xpDelta > 0 ? xpDelta : undefined,
  };

}

export async function reorderTasks(userId: string, ids: string[]) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx.update(tasks)
        .set({ sortIndex: i })
        .where(and(eq(tasks.id, ids[i]), eq(tasks.userId, userId), isNull(tasks.deletedAt)));
    }
  });
}

export async function moveTask(taskId: string, newStatus: TaskStatus, userId: string): Promise<Task> {

  const [task] = await db.update(tasks)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)));

  if (!task) throw new NotFoundError("Task not found");
  return task;
}
