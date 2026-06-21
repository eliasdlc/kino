import { db } from "@/shared/db";
import { tasks, users, userSettings, systems, folders, sprints, systemStatusDefinitions, timeLogs, taskReminders } from "@/shared/db/schema";
import { and, eq, isNull, isNotNull, sql, sum, count, or, gte, lte, type SQL } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@/shared/utils/error";
import { validateTransition, deriveBoardBridgeAction, type TaskStatus, type TransitionAction } from "./tasks.state-machine";
import { Task, CreateTaskInput, UpdateTaskInput } from "./tasks.types";
import type { z } from "zod";
import type { listTasksQuerySchema, CreateTimeLogInput } from "./tasks.schemas";
import { deriveStatusFromDate } from "./tasks.utils";

const ENERGY_POINTS: Record<string, number> = {
  high: 5,
  medium: 3,
  low: 1,
};

// Advisory lock class — namespaces energy locks from other advisory locks in the app.
const ENERGY_LOCK_CLASS = 42;
// Advisory lock class — serializa el rollover diario del plan por usuario.
const ROLLOVER_LOCK_CLASS = 43;

type DbTransaction = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/** Timezone del usuario (default UTC) — para derivar status "hoy/mañana". */
async function getUserTimezone(userId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.timezone ?? "UTC";
}

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
    currentStatus: current.status as TaskStatus,
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

  // Membresía del plan de hoy, desacoplada del status (modelo PLAN-07 Fase 1):
  // entrar a 'today' la une al plan; salir a un status de planificación la saca;
  // completar ('done') la conserva → sigue visible (tachada) hasta el rollover.
  if (transition.newStatus === "today") {
    updates.inTodayPlan = true;
  } else if (transition.newStatus !== "done") {
    updates.inTodayPlan = false;
  }

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

const AUTO_REMINDER_OFFSETS: Record<string, number[]> = {
  critical: [7, 3],
  high: [3],
};

async function syncAutoReminders(taskId: string, userId: string, dueDate: string, priority: string) {
  await db.delete(taskReminders).where(
    and(eq(taskReminders.taskId, taskId), eq(taskReminders.source, 'auto'), isNull(taskReminders.sentAt)),
  );

  const offsets = AUTO_REMINDER_OFFSETS[priority];
  if (!offsets) return;

  // dueDate ya es timestamptz (fase 3); puede traer hora propia.
  const dueTs = new Date(dueDate);
  const now = new Date();

  const toInsert = offsets
    .map((days) => {
      const remindAt = new Date(dueTs.getTime() - days * 86_400_000);
      const label = days === 7 ? '7 días antes' : days === 3 ? '3 días antes' : `${days} días antes`;
      return { taskId, userId, remindAt, label, source: 'auto' as const };
    })
    .filter(({ remindAt }) => remindAt > now);

  if (toInsert.length > 0) {
    await db.insert(taskReminders).values(toInsert);
  }
}

async function clearAutoReminders(taskId: string) {
  await db.delete(taskReminders).where(
    and(eq(taskReminders.taskId, taskId), eq(taskReminders.source, 'auto'), isNull(taskReminders.sentAt)),
  );
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

  if (data.sprintId) {
    const [sprint] = await db
      .select({ id: sprints.id })
      .from(sprints)
      .where(
        and(
          eq(sprints.id, data.sprintId),
          eq(sprints.systemId, data.systemId),
          eq(sprints.userId, userId),
        ),
      );
    if (!sprint) throw new ValidationError("Sprint not found in this system");
  }

  const explicitTerminal = data.status === "done" || data.status === "archived";
  // Ideas are always backlog — they are captures, not scheduled work
  // When startDate is given, derive status from date (authoritative).
  // When startDate is absent, respect an explicit status or fall back to backlog.
  const derivedStatus = explicitTerminal
    ? data.status
    : data.taskType === "idea"
      ? "backlog"
      : data.startDate
        ? deriveStatusFromDate(data.startDate, await getUserTimezone(userId))
        : (data.status ?? "backlog");

  const [task] = await db
    .insert(tasks)
    .values({
      ...data,
      status: derivedStatus,
      inTodayPlan: derivedStatus === "today",
      ...(data.boardStatus ? { boardStatusChangedAt: new Date() } : {}),
      userId,
    })
    .returning();

  if (task?.dueDate && task.priority in AUTO_REMINDER_OFFSETS) {
    await syncAutoReminders(task.id, userId, task.dueDate, task.priority);
  }

  // reminder type: create a taskReminder at the exact dueDate
  if (task?.taskType === 'reminder' && task.dueDate) {
    await db.insert(taskReminders).values({
      taskId: task.id,
      userId,
      remindAt: new Date(task.dueDate),
      label: 'Recordatorio',
      source: 'auto',
    });
  }

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
      dueDate: tasks.dueDate,
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

  if (data.sprintId) {
    const [sprint] = await db
      .select({ id: sprints.id })
      .from(sprints)
      .where(
        and(
          eq(sprints.id, data.sprintId),
          eq(sprints.systemId, targetSystemId),
          eq(sprints.userId, userId),
        ),
      );
    if (!sprint) throw new ValidationError("Sprint not found in this system");
  }

  // If system_id changes but folder_id isn't explicitly provided in the payload,
  // clear it to prevent orphaned folder references across systems.
  // Use `"folderId" in data` to distinguish "not provided" from "explicitly null".
  if (data.systemId && data.systemId !== current.systemId && !("folderId" in data)) {
    if (current.folderId) {
      data = { ...data, folderId: null } as UpdateTaskInput;
    }
  }

  // Auto-derive status when startDate or taskType changes (skip when status is explicit or task is terminal)
  const hasExplicitStatus = data.status !== undefined;
  if (!hasExplicitStatus && (data.startDate !== undefined || data.taskType !== undefined)) {
    if (!["done", "archived"].includes(current.status)) {
      const effectiveType = data.taskType ?? current.taskType;
      if (effectiveType === "idea") {
        data = { ...data, status: "backlog" } as UpdateTaskInput;
      } else if (data.startDate !== undefined) {
        const tz = await getUserTimezone(userId);
        data = { ...data, status: deriveStatusFromDate(data.startDate, tz) } as UpdateTaskInput;
      }
    }
  }

  // Resetear flags/recordatorios SOLO si el dueDate realmente cambió de valor,
  // no cada vez que el payload lo incluye (el autosave ya manda solo dirty, pero
  // este guard protege ante cualquier caller). Normalizamos a ISO para comparar.
  const curDueIso = current.dueDate ? new Date(current.dueDate).toISOString() : null;
  const newDueIso = data.dueDate ? new Date(data.dueDate).toISOString() : null;
  const dueChanged = data.dueDate !== undefined && newDueIso !== curDueIso;

  const reminderReset = dueChanged
    ? { notifiedBeforeDay: false, notifiedDueDay: false, reminderCount: 0, lastRemindedAt: null }
    : {};

  const [task] = await db
    .update(tasks)
    .set({ ...data, ...reminderReset, updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .returning();

  if (task && (dueChanged || data.priority !== undefined)) {
    if (task.dueDate && task.priority in AUTO_REMINDER_OFFSETS) {
      await syncAutoReminders(task.id, userId, task.dueDate, task.priority);
    } else {
      await clearAutoReminders(task.id);
    }
  }

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

export async function bulkMoveTasks(taskIds: string[], status: TaskStatus, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    for (const taskId of taskIds) {
      await applyTransition(tx, taskId, userId, (current) => {
        const action = deriveAction(current.status as TaskStatus, status);
        if (!action) {
          throw new ValidationError(`Cannot move task from '${current.status}' to '${status}'`);
        }
        return action;
      });
    }
  });
}

export async function bulkUpdateTasks(
  taskIds: string[],
  data: Pick<UpdateTaskInput, "priority">,
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const taskId of taskIds) {
      await tx
        .update(tasks)
        .set({ ...(data.priority !== undefined ? { priority: data.priority } : {}), updatedAt: new Date() })
        .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)));
    }
  });
}

export async function moveTask(taskId: string, newStatus: TaskStatus, userId: string): Promise<Task> {
  const { updated } = await db.transaction((tx) =>
    applyTransition(tx, taskId, userId, (current) => {
      const action = deriveAction(current.status as TaskStatus, newStatus);
      if (!action) {
        throw new ValidationError(`Cannot move task from '${current.status}' to '${newStatus}'`);
      }
      return action;
    }),
  );

  return updated;
}

/**
 * Mueve una tarjeta de columna del board (eje workflow del systemType `project`).
 * Valida que la columna exista para el tipo de sistema, actualiza board_status +
 * su timestamp, y aplica el puente con scheduling cuando entra/sale de la columna
 * terminal (done), reusando la state machine (completedAt + XP).
 */
export async function moveTaskBoard(taskId: string, boardStatus: string, userId: string): Promise<Task> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        status: tasks.status,
        boardStatus: tasks.boardStatus,
        systemId: tasks.systemId,
      })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)));
    if (!current) throw new NotFoundError("Task not found");

    // La columna debe estar definida para el tipo del sistema (solo `project` las tiene).
    const [col] = await tx
      .select({ statusName: systemStatusDefinitions.statusName })
      .from(systemStatusDefinitions)
      .innerJoin(systems, eq(systems.templateType, systemStatusDefinitions.systemType))
      .where(
        and(
          eq(systems.id, current.systemId),
          eq(systemStatusDefinitions.statusName, boardStatus),
        ),
      );
    if (!col) throw new ValidationError(`Invalid board column '${boardStatus}' for this system`);

    await tx
      .update(tasks)
      .set({ boardStatus, boardStatusChangedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId), isNull(tasks.deletedAt)));

    // Puente con scheduling: la columna terminal completa/descompleta la tarea.
    const bridge = deriveBoardBridgeAction(
      current.status as TaskStatus,
      current.boardStatus,
      boardStatus,
    );
    if (bridge) {
      await applyTransition(tx, taskId, userId, () => bridge);
    }

    const [updated] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
    return updated as Task;
  });
}

/**
 * Rollover diario del plan de hoy (lazy, al leer el plan).
 *
 * El plan de hoy es "lo que me comprometí a hacer hoy" y se resetea cada día.
 * Como no hay cron de rollover, esto corre al leer /today-plan: si la marca
 * `today_plan_date` es de un día anterior (o null), en una sola transacción:
 *   1. limpia in_today_plan de la jornada anterior,
 *   2. repuebla con las tareas activas cuyo start_date es hoy,
 *   3. actualiza la marca a hoy.
 * Idempotente dentro del mismo día (no toca nada si ya se rolleó).
 */
export async function ensureTodayPlanRolled(userId: string): Promise<void> {
  const [userRow] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId));
  const tz = userRow?.timezone ?? "UTC";
  const today = sql`(NOW() AT TIME ZONE ${tz})::date`;
  const tomorrow = sql`((NOW() AT TIME ZONE ${tz})::date + INTERVAL '1 day')::date`;

  await db.transaction(async (tx) => {
    // Serializa rollovers concurrentes del mismo usuario.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${ROLLOVER_LOCK_CLASS}, hashtext(${userId}))`,
    );

    const [row] = await tx
      .select({
        stale: sql<boolean>`(${userSettings.todayPlanDate} IS NULL OR ${userSettings.todayPlanDate} < ${today})`,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId));

    // Sin fila de settings (pre-onboarding) o ya rolleado hoy → nada que hacer.
    if (!row || !row.stale) return;

    // 0. Reconcilia los status de scheduling (tomorrow→today, today de ayer→…)
    //    ANTES de repoblar el plan, para que ambos vean el mismo día.
    await reconcileStatusesInTx(tx, userId, today, tomorrow, tz);

    // 1. Limpia el plan del día anterior.
    await tx.execute(
      sql`UPDATE tasks SET in_today_plan = false, updated_at = NOW()
          WHERE user_id = ${userId} AND in_today_plan = true`,
    );

    // 2. Repuebla con tareas activas programadas para hoy (start_date = hoy,
    //    comparando el día calendario en la tz del usuario; start_date es timestamptz).
    await tx.execute(
      sql`UPDATE tasks SET in_today_plan = true, updated_at = NOW()
          WHERE user_id = ${userId} AND deleted_at IS NULL
            AND parent_task_id IS NULL
            AND status NOT IN ('done', 'archived')
            AND (start_date AT TIME ZONE ${tz})::date = ${today}`,
    );

    // 3. Marca el plan como rolleado hoy.
    await tx.execute(
      sql`UPDATE user_settings SET today_plan_date = ${today}, updated_at = NOW()
          WHERE user_id = ${userId}`,
    );
  });
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

  await db.transaction((tx) => reconcileStatusesInTx(tx, userId, today, tomorrow, tz));
}

/**
 * Núcleo de la reconciliación: recoloca el status de scheduling de cada tarea
 * activa según su start_date, en la transacción dada. Compartido por
 * reconcileTaskStatuses (tx propia) y ensureTodayPlanRolled (misma tx que el
 * rollover, para que reconcile y repoblado vean el mismo día).
 */
async function reconcileStatusesInTx(
  tx: DbTransaction,
  userId: string,
  today: SQL,
  tomorrow: SQL,
  tz: string,
): Promise<void> {
  // Ideas are always backlog — exclude from date-driven status updates
  const notIdea = sql`(task_type IS NULL OR task_type != 'idea')`;
  // start_date es timestamptz: comparamos su día calendario en la tz del usuario.
  const startDay = sql`(start_date AT TIME ZONE ${tz})::date`;

  // Tasks with start_date = today → status should be "today"
  await tx.execute(
    sql`UPDATE tasks SET status = 'today', updated_at = NOW()
        WHERE user_id = ${userId} AND deleted_at IS NULL
          AND status NOT IN ('done', 'archived')
          AND ${notIdea}
          AND ${startDay} = ${today}
          AND status != 'today'`
  );

  // Tasks with start_date = tomorrow → status should be "tomorrow"
  await tx.execute(
    sql`UPDATE tasks SET status = 'tomorrow', updated_at = NOW()
        WHERE user_id = ${userId} AND deleted_at IS NULL
          AND status NOT IN ('done', 'archived')
          AND ${notIdea}
          AND ${startDay} = ${tomorrow}
          AND status != 'tomorrow'`
  );

  // Tasks with start_date set but not today/tomorrow → status should be "week"
  await tx.execute(
    sql`UPDATE tasks SET status = 'week', updated_at = NOW()
        WHERE user_id = ${userId} AND deleted_at IS NULL
          AND status NOT IN ('done', 'archived')
          AND ${notIdea}
          AND start_date IS NOT NULL
          AND ${startDay} != ${today}
          AND ${startDay} != ${tomorrow}
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
}

export async function queryTasks(
  userId: string,
  filters: z.infer<typeof listTasksQuerySchema>,
) {
  const conditions = [
    eq(tasks.userId, userId),
    filters.deleted ? isNotNull(tasks.deletedAt) : isNull(tasks.deletedAt),
    isNull(tasks.parentTaskId),
  ];

  if (filters.systemId) conditions.push(eq(tasks.systemId, filters.systemId));
  if (filters.energyLevel) conditions.push(eq(tasks.energyLevel, filters.energyLevel));
  if (filters.status) conditions.push(eq(tasks.status, filters.status));

  return db.select().from(tasks).where(and(...conditions)).orderBy(tasks.sortIndex);
}

export async function bulkCreateTasks(
  userId: string,
  items: CreateTaskInput[],
): Promise<Task[]> {
  const settled = await Promise.all(items.map((item) => createTask(userId, item)));
  return settled.filter((t): t is Task => t !== null);
}

export async function getTimeLogSummary(
  taskId: string,
  userId: string,
): Promise<{ totalMinutes: number; sessionCount: number }> {
  const [row] = await db
    .select({
      totalMinutes: sum(timeLogs.durationMinutes),
      sessionCount: count(timeLogs.id),
    })
    .from(timeLogs)
    .where(and(eq(timeLogs.taskId, taskId), eq(timeLogs.userId, userId)));
  return {
    totalMinutes: Number(row?.totalMinutes ?? 0),
    sessionCount: Number(row?.sessionCount ?? 0),
  };
}

export async function getScheduledTasks(userId: string, fromISO: string, toISO: string): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        isNull(tasks.deletedAt),
        or(
          and(isNotNull(tasks.dueDate), gte(tasks.dueDate, fromISO), lte(tasks.dueDate, toISO)),
          and(isNotNull(tasks.startDate), gte(tasks.startDate, fromISO), lte(tasks.startDate, toISO)),
        ),
      ),
    )
    .orderBy(tasks.dueDate);
}

export async function createTimeLog(
  taskId: string,
  userId: string,
  data: CreateTimeLogInput,
): Promise<void> {
  const [task] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!task) throw new NotFoundError('Task not found');

  await db.insert(timeLogs).values({
    userId,
    taskId,
    systemId: data.systemId,
    startedAt: new Date(data.startedAt),
    endedAt: new Date(data.endedAt),
    durationMinutes: data.durationMinutes,
    source: data.source,
  });
}
