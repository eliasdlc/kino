import { db } from "@/shared/db";
import { tasks, users, userSettings, systems } from "@/shared/db/schema";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/shared/utils/error";
import { validateTransition, type TaskStatus, type TransitionAction } from "./tasks.state-machine";
import { Task, CreateTaskInput, UpdateTaskInput } from "./tasks.types";

const ENERGY_POINTS: Record<string, number> = {
  high: 5,
  medium: 3,
  low: 1,
};

// Advisory lock class — namespaces energy locks from other advisory locks in the app.
const ENERGY_LOCK_CLASS = 42;

type DbTransaction = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/**
 * Acquires a per-user advisory transaction lock, then reads the task, validates
 * the requested transition, applies side-effects, and persists the result —
 * all inside the caller's transaction.
 *
 * The advisory lock serializes concurrent energy-budget checks for the same
 * user, preventing two simultaneous toggles from both bypassing dailyEnergyLimit.
 */
async function applyTransition(
  tx: DbTransaction,
  taskId: string,
  userId: string,
  getAction: (current: Task) => TransitionAction,
): Promise<{ updated: Task; xpDelta: number }> {
  // Serialize concurrent energy operations per user via a transaction-scoped advisory lock.
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(${ENERGY_LOCK_CLASS}, hashtext(${userId}))`,
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [settings] = await tx
    .select({ dailyEnergyLimit: userSettings.dailyEnergyLimit })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  const [current] = await tx
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)));

  if (!current) throw new NotFoundError("Task not found");

  const doneTodayRows = await tx
    .select({ energyLevel: tasks.energyLevel })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "done"),
        gte(tasks.completedAt, todayStart),
        isNull(tasks.deletedAt),
      ),
    );

  const currentDayEnergyUsed = doneTodayRows.reduce(
    (sum, row) => sum + (ENERGY_POINTS[row.energyLevel ?? "medium"] ?? 3),
    0,
  );

  const action = getAction(current as Task);

  const transition = validateTransition({
    currentStatus: current.status,
    action,
    taskEnergyPoints: ENERGY_POINTS[current.energyLevel ?? "medium"] ?? 3,
    currentDayEnergyUsed,
    dailyEnergyLimit: settings?.dailyEnergyLimit ?? 50,
    isRecurring: current.recurrenceRule !== null && current.recurrenceRule !== undefined,
  });

  if (!transition.valid || !transition.newStatus) {
    throw new ValidationError(transition.error ?? "Invalid transition");
  }

  const updates: Partial<typeof tasks.$inferInsert> = {
    status: transition.newStatus,
    updatedAt: new Date(),
  };

  let xpDelta = 0;

  for (const effect of transition.sideEffects ?? []) {
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
      case "set_deleted_at":
        updates.deletedAt = effect.value;
        break;
    }
  }

  const [updated] = await tx
    .update(tasks)
    .set(updates)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .returning();

  if (!updated) throw new NotFoundError("Task not found");

  if (xpDelta !== 0) {
    await tx
      .update(users)
      .set({ xpTotal: sql`${users.xpTotal} + ${xpDelta}` })
      .where(eq(users.id, userId));
  }

  return { updated: updated as Task, xpDelta };
}

function deriveAction(currentStatus: TaskStatus, targetStatus: TaskStatus): TransitionAction | undefined {
  const map: Record<string, TransitionAction> = {
    "backlog->week": "move_to_week",
    "backlog->today": "move_to_today",
    "backlog->done": "toggle_done",
    "week->today": "move_to_today",
    "week->backlog": "move_to_backlog",
    "week->done": "toggle_done",
    "today->done": "toggle_done",
    "today->backlog": "move_to_backlog",
    "done->today": "undo_done",
  };
  return map[`${currentStatus}->${targetStatus}`];
}

export async function getTasksBySystem(systemId: string, userId: string) {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.systemId, systemId),
        eq(tasks.userId, userId),
        isNull(tasks.deletedAt),
        isNull(tasks.parentTaskId),
      ),
    )
    .orderBy(tasks.sortIndex);
}

export async function getSubtasks(taskId: string, userId: string) {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.parentTaskId, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .orderBy(tasks.sortIndex);
}

export async function createTask(userId: string, data: CreateTaskInput) {
  const [system] = await db
    .select({ id: systems.id })
    .from(systems)
    .where(and(eq(systems.id, data.systemId), eq(systems.userId, userId)));

  if (!system) throw new NotFoundError("System not found");

  if (data.parentTaskId) {
    const [parent] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, data.parentTaskId),
          eq(tasks.userId, userId),
          isNull(tasks.deletedAt),
        ),
      );
    if (!parent) throw new NotFoundError("Parent task not found");
  }

  const [task] = await db.insert(tasks).values({ ...data, userId }).returning();

  return task ?? null;
}

export async function updateTask(taskId: string, userId: string, data: UpdateTaskInput) {
  const [task] = await db
    .update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .returning();

  return task ?? null;
}

export async function deleteTask(taskId: string, userId: string) {
  const [task] = await db
    .update(tasks)
    .set({ deletedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .returning();

  if (!task) throw new NotFoundError("Task not found");
  return task;
}

export async function toggleTask(
  taskId: string,
  userId: string,
): Promise<{ status: string; xp_earned?: number }> {
  let resultStatus = "";
  let xpDelta = 0;

  await db.transaction(async (tx) => {
    const { updated, xpDelta: delta } = await applyTransition(
      tx,
      taskId,
      userId,
      (current) => (current.status === "done" ? "undo_done" : "toggle_done"),
    );
    resultStatus = updated.status;
    xpDelta = delta;
  });

  return {
    status: resultStatus,
    xp_earned: xpDelta > 0 ? xpDelta : undefined,
  };
}

export async function reorderTasks(userId: string, ids: string[]) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      await tx
        .update(tasks)
        .set({ sortIndex: i })
        .where(and(eq(tasks.id, ids[i]), eq(tasks.userId, userId), isNull(tasks.deletedAt)));
    }
  });
}

export async function moveTask(taskId: string, newStatus: TaskStatus, userId: string): Promise<Task> {
  let updatedTask: Task | null = null;

  await db.transaction(async (tx) => {
    const { updated } = await applyTransition(tx, taskId, userId, (current) => {
      const action = deriveAction(current.status, newStatus);
      if (!action) {
        throw new ValidationError(`Cannot move task from '${current.status}' to '${newStatus}'`);
      }
      return action;
    });
    updatedTask = updated;
  });

  if (!updatedTask) throw new NotFoundError("Task not found");
  return updatedTask;
}
