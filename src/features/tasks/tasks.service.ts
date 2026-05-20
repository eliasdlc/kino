import { db } from "@/shared/db";
import { tasks, users, userSettings, systems, folders } from "@/shared/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/shared/utils/error";
import { validateTransition, type TaskStatus, type TransitionAction } from "./tasks.state-machine";
import { Task, CreateTaskInput, UpdateTaskInput } from "./tasks.types";
import { deriveStatusFromDate } from "./tasks.utils";

const ENERGY_POINTS: Record<string, number> = {
  high: 5,
  medium: 3,
  low: 1,
};

// Advisory lock class — namespaces energy locks from other advisory locks in the app.
const ENERGY_LOCK_CLASS = 42;

type DbTransaction = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

// Acquires a per-user advisory transaction lock, validates the transition, applies side-effects, and persists — all within the caller's transaction.
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

  const [settingsRow] = await tx
    .select({
      dailyEnergyLimit: userSettings.dailyEnergyLimit,
      timezone: users.timezone,
    })
    .from(userSettings)
    .innerJoin(users, eq(users.id, userSettings.userId))
    .where(eq(userSettings.userId, userId));

  // Compute "today" boundary in the user's timezone, not UTC
  const tz = settingsRow?.timezone ?? "UTC";

  const [current] = await tx
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)));

  if (!current) throw new NotFoundError("Task not found");

  // Use timezone-aware SQL to count tasks completed "today" in user's local time
  const doneTodayRows = await tx
    .select({ energyLevel: tasks.energyLevel })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "done"),
        sql`${tasks.completedAt} >= (NOW() AT TIME ZONE ${tz})::date::timestamptz`,
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
    dailyEnergyLimit: settingsRow?.dailyEnergyLimit ?? 50,
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
    "backlog->tomorrow": "move_to_tomorrow",
    "backlog->today": "move_to_today",
    "backlog->done": "toggle_done",
    "week->today": "move_to_today",
    "week->tomorrow": "move_to_tomorrow",
    "week->backlog": "move_to_backlog",
    "week->done": "toggle_done",
    "tomorrow->today": "move_to_today",
    "tomorrow->week": "move_to_week",
    "tomorrow->backlog": "move_to_backlog",
    "tomorrow->done": "toggle_done",
    "today->tomorrow": "move_to_tomorrow",
    "today->week": "move_to_week",
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

export async function getTaskById(taskId: string, userId: string): Promise<Task | null> {
  const [task] = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.userId, userId),
        isNull(tasks.deletedAt),
      ),
    );
  return (task as Task) ?? null;
}

export async function getSubtasks(taskId: string, userId: string) {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.parentTaskId, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .orderBy(tasks.sortIndex);
}

// Returns tasks directly assigned to a folder via folder_id.
// folder_id is the single source of truth — page links don't affect placement.
export async function getTasksByFolder(
  folderId: string,
  systemId: string,
  userId: string,
): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.folderId, folderId),
        eq(tasks.systemId, systemId),
        eq(tasks.userId, userId),
        isNull(tasks.deletedAt),
        isNull(tasks.parentTaskId),
      ),
    )
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

  if (data.folderId) {
    const [folder] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(
        and(
          eq(folders.id, data.folderId),
          eq(folders.systemId, data.systemId),
          eq(folders.userId, userId),
        ),
      );
    if (!folder) throw new ValidationError("Folder not found in this system");
  }

  const explicitTerminal = data.status === "done" || data.status === "archived";
  // Ideas are always backlog — they are captures, not scheduled work
  const derivedStatus = explicitTerminal
    ? data.status
    : data.taskType === "idea"
      ? "backlog"
      : deriveStatusFromDate(data.startDate ?? null);

  const [task] = await db
    .insert(tasks)
    .values({ ...data, status: derivedStatus, userId })
    .returning();

  return task ?? null;
}

export async function updateTask(taskId: string, userId: string, data: UpdateTaskInput) {
  // Fetch current task state once — avoid multiple queries for the same row
  const [current] = await db
    .select({
      systemId: tasks.systemId,
      folderId: tasks.folderId,
      status: tasks.status,
      taskType: tasks.taskType,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)));

  if (!current) throw new NotFoundError("Task not found");

  // Validate new system exists and belongs to user
  if (data.systemId && data.systemId !== current.systemId) {
    const [system] = await db
      .select({ id: systems.id })
      .from(systems)
      .where(and(eq(systems.id, data.systemId), eq(systems.userId, userId)));
    if (!system) throw new NotFoundError("System not found");
  }

  const targetSystemId = data.systemId ?? current.systemId;

  // Validate folder↔system consistency when folder_id is being set
  if (data.folderId) {
    const [folder] = await db
      .select({ id: folders.id })
      .from(folders)
      .where(
        and(
          eq(folders.id, data.folderId),
          eq(folders.systemId, targetSystemId),
          eq(folders.userId, userId),
        ),
      );

    if (!folder) throw new ValidationError("Folder not found in this system");
  }

  // If system_id changes but folder_id isn't explicitly provided in the payload,
  // clear it to prevent orphaned folder references across systems.
  // Use `"folderId" in data` to distinguish "not provided" from "explicitly null".
  if (data.systemId && data.systemId !== current.systemId && !("folderId" in data)) {
    if (current.folderId) {
      data = { ...data, folderId: null } as UpdateTaskInput;
    }
  }

  // Auto-derive status when startDate or taskType changes (skip for terminal tasks)
  if (data.startDate !== undefined || data.taskType !== undefined) {
    if (!(["done", "archived"] as string[]).includes(current.status)) {
      const effectiveType = data.taskType ?? current.taskType;
      if (effectiveType === "idea") {
        // Changing to idea forces backlog
        data = { ...data, status: "backlog" } as UpdateTaskInput;
      } else if (data.startDate !== undefined) {
        data = { ...data, status: deriveStatusFromDate(data.startDate) } as UpdateTaskInput;
      }
    }
  }

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

export async function restoreTask(taskId: string, userId: string) {
  const [task] = await db
    .update(tasks)
    .set({ deletedAt: null })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning();

  if (!task) throw new NotFoundError("Task not found");
  return task;
}

export async function toggleTask(
  taskId: string,
  userId: string,
): Promise<{ status: string; xp_earned?: number }> {
  const { updated, xpDelta } = await db.transaction((tx) =>
    applyTransition(tx, taskId, userId, (current) =>
      current.status === "done" ? "undo_done" : "toggle_done",
    ),
  );

  return {
    status: updated.status,
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
  const { updated } = await db.transaction((tx) =>
    applyTransition(tx, taskId, userId, (current) => {
      const action = deriveAction(current.status, newStatus);
      if (!action) {
        throw new ValidationError(`Cannot move task from '${current.status}' to '${newStatus}'`);
      }
      return action;
    }),
  );

  return updated;
}

/**
 * Daily reconciliation: recalculates scheduling statuses for all active tasks.
 *
 * Called via:
 *  - Lazy Evaluation on user login (catches up stale statuses)
 *  - Vercel Cron daily job (optional, ensures freshness)
 *
 * Uses batch SQL for efficiency — one UPDATE per status bucket.
 */
export async function reconcileTaskStatuses(userId: string): Promise<void> {
  // DATE columns store logical dates in the user's timezone (per SADD convention).
  // CURRENT_DATE uses the DB server timezone (UTC), which is wrong at timezone boundaries.
  const [userRow] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId));

  const tz = userRow?.timezone ?? "UTC";
  const today = sql`(NOW() AT TIME ZONE ${tz})::date`;
  const tomorrow = sql`((NOW() AT TIME ZONE ${tz})::date + INTERVAL '1 day')::date`;

  await db.transaction(async (tx) => {
    // Ideas are always backlog — exclude from date-driven status updates
    const notIdea = sql`(task_type IS NULL OR task_type != 'idea')`;

    // Tasks with start_date = today → status should be "today"
    await tx.execute(
      sql`UPDATE tasks SET status = 'today', updated_at = NOW()
          WHERE user_id = ${userId} AND deleted_at IS NULL
            AND status NOT IN ('done', 'archived')
            AND ${notIdea}
            AND start_date = ${today}
            AND status != 'today'`
    );

    // Tasks with start_date = tomorrow → status should be "tomorrow"
    await tx.execute(
      sql`UPDATE tasks SET status = 'tomorrow', updated_at = NOW()
          WHERE user_id = ${userId} AND deleted_at IS NULL
            AND status NOT IN ('done', 'archived')
            AND ${notIdea}
            AND start_date = ${tomorrow}
            AND status != 'tomorrow'`
    );

    // Tasks with start_date set but not today/tomorrow → status should be "week"
    await tx.execute(
      sql`UPDATE tasks SET status = 'week', updated_at = NOW()
          WHERE user_id = ${userId} AND deleted_at IS NULL
            AND status NOT IN ('done', 'archived')
            AND ${notIdea}
            AND start_date IS NOT NULL
            AND start_date != ${today}
            AND start_date != ${tomorrow}
            AND status != 'week'`
    );

    // Tasks without start_date (and not ideas) → status should be "backlog"
    await tx.execute(
      sql`UPDATE tasks SET status = 'backlog', updated_at = NOW()
          WHERE user_id = ${userId} AND deleted_at IS NULL
            AND status NOT IN ('done', 'archived')
            AND ${notIdea}
            AND start_date IS NULL
            AND status != 'backlog'`
    );
  });
}
