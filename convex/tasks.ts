import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { computeNextOccurrence } from '../src/features/tasks/recurrence';
import { validateTaskKind } from '../src/features/tasks/tasks.metadata';
import {
  actionForTransition,
  deriveBoardBridgeAction,
  validateTransition,
  type TransitionAction,
} from '../src/features/tasks/tasks.state-machine';
import { resolveManifest } from '../src/shared/lib/system-manifest';
import type { SystemMetadata } from '../src/shared/lib/system-types';
import { invalid, notFound } from './lib/errors';
import { kinoZodMutation, kinoZodQuery } from './lib/fn';
import { lematizar } from './lib/lemas';
import {
  createTaskSchema,
  createTimeLogSchema,
  listTasksSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type TaskStatus,
} from './lib/tasks/schemas';
import { deriveStatusFromDate, findParentViolation } from './lib/tasks/status';
import { calendarDayInTz, userToday } from './lib/time';

// Las tareas. Cada mutación es una transacción, así que lo que antes eran
// `db.transaction` y locks de aviso aquí es simplemente el cuerpo de la
// función. La máquina de estados, la recurrencia y la validación de `kind`
// son los mismos módulos puros que usaba la API REST.

type TaskDoc = Doc<'tasks'>;
type Ctx = QueryCtx | MutationCtx;

const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());
const ms = (value: string) => Date.parse(value);
const optMs = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? undefined : ms(value);

/**
 * La tarea tal como la ve el cliente: la misma forma que la fila de Postgres
 * viajaba por la API, con ids de Convex y fechas en texto ISO.
 */
export function taskItem(doc: TaskDoc) {
  return {
    id: doc._id,
    userId: doc.userId,
    systemId: doc.systemId,
    parentTaskId: doc.parentTaskId ?? null,
    title: doc.title,
    description: doc.description ?? null,
    status: doc.status,
    boardStatus: doc.boardStatus ?? null,
    boardStatusChangedAt: iso(doc.boardStatusChangedAt),
    energyLevel: doc.energyLevel,
    priority: doc.priority,
    taskType: doc.taskType ?? null,
    dueDate: iso(doc.dueDate),
    startDate: iso(doc.startDate),
    estimatedTime: doc.estimatedTime ?? null,
    recurrenceRule: doc.recurrenceRule ?? null,
    recurrenceParentId: doc.recurrenceParentId ?? null,
    folderId: doc.folderId ?? null,
    contextTagId: doc.contextTagId ?? null,
    sprintId: doc.sprintId ?? null,
    externalSource: doc.externalSource ?? null,
    externalId: doc.externalId ?? null,
    clientRequestId: doc.clientRequestId ?? null,
    sortIndex: doc.sortIndex,
    metadata: doc.metadata ?? null,
    inTodayPlan: doc.inTodayPlan,
    notifiedBeforeDay: doc.notifiedBeforeDay,
    notifiedDueDay: doc.notifiedDueDay,
    reminderCount: doc.reminderCount,
    lastRemindedAt: iso(doc.lastRemindedAt),
    completedAt: iso(doc.completedAt),
    deletedAt: iso(doc.deletedAt),
    createdAt: iso(doc.createdAt)!,
    updatedAt: iso(doc.updatedAt)!,
  };
}
export type TaskItem = ReturnType<typeof taskItem>;

const bySort = (a: TaskDoc, b: TaskDoc) => a.sortIndex - b.sortIndex;
const alive = (doc: TaskDoc) => doc.deletedAt === undefined;
const topLevel = (doc: TaskDoc) => doc.parentTaskId === undefined;

/** Todas las tareas vivas del usuario, por índice. Son pocas por persona. */
async function aliveTasks(ctx: Ctx, userId: Id<'users'>) {
  return ctx.db
    .query('tasks')
    .withIndex('by_user_alive_status', (q) => q.eq('userId', userId).eq('deletedAt', undefined))
    .collect();
}

export async function ownTask(ctx: Ctx, userId: Id<'users'>, id: Id<'tasks'>, { includeDeleted = false } = {}) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId || (!includeDeleted && !alive(doc))) notFound('Task not found');
  return doc;
}

async function ownSystem(ctx: Ctx, userId: Id<'users'>, id: Id<'systems'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId) notFound('System not found');
  return doc;
}

/** Las referencias que entran tienen que ser del usuario y del sistema. */
async function assertRefs(
  ctx: Ctx,
  userId: Id<'users'>,
  systemId: Id<'systems'>,
  refs: { folderId?: Id<'folders'> | null; sprintId?: Id<'sprints'> | null; contextTagId?: Id<'contextTags'> | null },
) {
  if (refs.folderId) {
    const folder = await ctx.db.get(refs.folderId);
    if (!folder || folder.userId !== userId || folder.systemId !== systemId) invalid('Folder not found in this system');
  }
  if (refs.sprintId) {
    const sprint = await ctx.db.get(refs.sprintId);
    if (!sprint || sprint.userId !== userId || sprint.systemId !== systemId) invalid('Sprint not found in this system');
  }
  if (refs.contextTagId) {
    const tag = await ctx.db.get(refs.contextTagId);
    if (!tag || tag.userId !== userId) invalid('Context tag not found');
  }
}

async function assertValidParent(ctx: Ctx, userId: Id<'users'>, taskId: Id<'tasks'>, parentTaskId: Id<'tasks'>) {
  const parent = await ctx.db.get(parentTaskId);
  if (parentTaskId !== taskId && (!parent || parent.userId !== userId || !alive(parent))) {
    invalid('Parent task not found');
  }
  const violation = await findParentViolation(taskId, parentTaskId, async (id) => {
    const doc = await ctx.db.get(id as Id<'tasks'>);
    return doc?.userId === userId ? doc.parentTaskId : undefined;
  });
  if (violation === 'self') invalid('A task cannot be its own parent');
  if (violation === 'cycle') invalid('Circular parent reference');
}

function assertKind(system: Doc<'systems'>, metadata: unknown) {
  const error = validateTaskKind(
    resolveManifest(system.templateType, (system.metadata ?? null) as SystemMetadata | null),
    metadata,
  );
  if (error) invalid(error);
}

// ── Recordatorios automáticos ───────────────────────────────────────────────

const AUTO_REMINDER_OFFSETS: Record<string, number[]> = { critical: [7, 3], high: [3] };

async function clearAutoReminders(ctx: MutationCtx, taskId: Id<'tasks'>) {
  const reminders = await ctx.db
    .query('taskReminders')
    .withIndex('by_task', (q) => q.eq('taskId', taskId))
    .collect();
  for (const reminder of reminders) {
    if (reminder.source === 'auto' && reminder.sentAt === undefined) await ctx.db.delete(reminder._id);
  }
}

async function syncAutoReminders(ctx: MutationCtx, task: TaskDoc, now: number) {
  await clearAutoReminders(ctx, task._id);
  const offsets = task.dueDate !== undefined ? AUTO_REMINDER_OFFSETS[task.priority] : undefined;
  if (!offsets || task.dueDate === undefined) return;
  for (const days of offsets) {
    const remindAt = task.dueDate - days * 86_400_000;
    if (remindAt <= now) continue;
    await ctx.db.insert('taskReminders', {
      taskId: task._id,
      userId: task.userId,
      remindAt,
      label: `${days} días antes`,
      source: 'auto',
      createdAt: now,
    });
  }
}

// ── Transiciones ────────────────────────────────────────────────────────────

/** Valida y aplica una transición de la máquina de estados. `null` es no-op. */
async function applyTransition(
  ctx: MutationCtx,
  task: TaskDoc,
  getAction: (current: TaskDoc) => TransitionAction | null,
): Promise<TaskDoc> {
  const action = getAction(task);
  if (action === null) return task;

  const transition = validateTransition({
    currentStatus: task.status,
    action,
    isRecurring: task.recurrenceRule !== undefined,
  });
  if (!transition.valid || !transition.newStatus) invalid(transition.error ?? 'Invalid transition');

  const now = Date.now();
  const patch: Partial<TaskDoc> = { status: transition.newStatus, updatedAt: now };
  // Membresía del plan de hoy, desacoplada del status: entrar a hoy la une,
  // salir a planificación la saca, completar la conserva hasta el rollover.
  if (transition.newStatus === 'today') patch.inTodayPlan = true;
  else if (transition.newStatus !== 'done') patch.inTodayPlan = false;
  for (const effect of transition.sideEffects ?? []) {
    if (effect.type === 'set_completed_at') patch.completedAt = now;
    if (effect.type === 'clear_completed_at') patch.completedAt = undefined;
  }
  await ctx.db.patch(task._id, patch);
  const updated = (await ctx.db.get(task._id))!;

  if (transition.sideEffects?.some((e) => e.type === 'generate_next_rrule_instance')) {
    await spawnNextRecurrence(ctx, updated, now);
  }
  return updated;
}

/** Siembra la siguiente ocurrencia de una serie al completar una. */
async function spawnNextRecurrence(ctx: MutationCtx, task: TaskDoc, now: number) {
  if (!task.recurrenceRule) return;
  const usesStart = task.dueDate === undefined && task.startDate !== undefined;
  const anchor = task.dueDate ?? task.startDate ?? now;
  const next = computeNextOccurrence(task.recurrenceRule, new Date(anchor));
  if (!next) return;
  const nextMs = next.getTime();
  const seriesRoot = task.recurrenceParentId ?? task._id;

  const siblings = await ctx.db
    .query('tasks')
    .withIndex('by_recurrenceParent', (q) => q.eq('recurrenceParentId', seriesRoot))
    .collect();
  const anchorOf = (doc: TaskDoc) => (usesStart ? doc.startDate : doc.dueDate);
  if (siblings.some((doc) => alive(doc) && anchorOf(doc) === nextMs)) return;

  const user = (await ctx.db.get(task.userId))!;
  const status = deriveStatusFromDate(usesStart ? nextMs : task.startDate, user.timezone, now);
  await ctx.db.insert('tasks', {
    userId: task.userId,
    systemId: task.systemId,
    title: task.title,
    description: task.description,
    energyLevel: task.energyLevel,
    priority: task.priority,
    taskType: task.taskType,
    estimatedTime: task.estimatedTime,
    folderId: task.folderId,
    sprintId: task.sprintId,
    contextTagId: task.contextTagId,
    boardStatus: task.boardStatus,
    metadata: task.metadata,
    recurrenceRule: task.recurrenceRule,
    recurrenceParentId: seriesRoot,
    startDate: usesStart ? nextMs : task.startDate,
    dueDate: usesStart ? task.dueDate : nextMs,
    status,
    inTodayPlan: status === 'today',
    notifiedBeforeDay: false,
    notifiedDueDay: false,
    reminderCount: 0,
    sortIndex: 0,
    lemas: task.lemas,
    createdBy: task.createdBy,
    createdVia: 'system',
    createdAt: now,
    updatedAt: now,
  });
}

// ── Lecturas ────────────────────────────────────────────────────────────────

export const list = kinoZodQuery({
  args: listTasksSchema,
  handler: async (ctx, filters) => {
    let docs: TaskDoc[];
    if (filters.deleted) {
      const all = await ctx.db
        .query('tasks')
        .withIndex('by_user_alive_status', (q) => q.eq('userId', ctx.user._id))
        .collect();
      docs = all.filter((doc) => !alive(doc));
    } else {
      docs = await aliveTasks(ctx, ctx.user._id);
    }
    return docs
      .filter(topLevel)
      .filter((doc) => !filters.systemId || doc.systemId === filters.systemId)
      .filter((doc) => !filters.energyLevel || doc.energyLevel === filters.energyLevel)
      .filter((doc) => !filters.status || doc.status === filters.status)
      .sort(bySort)
      .map(taskItem);
  },
});

export const bySystem = kinoZodQuery({
  args: { systemId: zid('systems') },
  handler: async (ctx, { systemId }) => {
    const docs = await ctx.db
      .query('tasks')
      .withIndex('by_system_alive_status', (q) => q.eq('systemId', systemId).eq('deletedAt', undefined))
      .collect();
    return docs.filter((doc) => doc.userId === ctx.user._id && topLevel(doc)).sort(bySort).map(taskItem);
  },
});

export const byFolder = kinoZodQuery({
  args: { systemId: zid('systems'), folderId: zid('folders') },
  handler: async (ctx, { systemId, folderId }) => {
    const docs = await ctx.db
      .query('tasks')
      .withIndex('by_folder_alive', (q) => q.eq('folderId', folderId).eq('deletedAt', undefined))
      .collect();
    return docs
      .filter((doc) => doc.userId === ctx.user._id && doc.systemId === systemId && topLevel(doc))
      .sort(bySort)
      .map(taskItem);
  },
});

export const byId = kinoZodQuery({
  args: { id: zid('tasks') },
  handler: async (ctx, { id }) => taskItem(await ownTask(ctx, ctx.user._id, id)),
});

export const subtasks = kinoZodQuery({
  args: { id: zid('tasks') },
  handler: async (ctx, { id }) => {
    const docs = await ctx.db
      .query('tasks')
      .withIndex('by_parent', (q) => q.eq('parentTaskId', id))
      .collect();
    return docs.filter((doc) => doc.userId === ctx.user._id && alive(doc)).sort(bySort).map(taskItem);
  },
});

/**
 * El plan de hoy tal como está guardado. Quien lo pinta llama antes a
 * `rollTodayPlan`, que es la mutación que lo pone al día.
 */
export const todayPlan = kinoZodQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await aliveTasks(ctx, ctx.user._id);
    return docs.filter((doc) => topLevel(doc) && doc.inTodayPlan).sort(bySort).map(taskItem);
  },
});

/** Tareas con inicio o vencimiento dentro del rango del calendario. */
export const calendar = kinoZodQuery({
  args: { from: z.string(), to: z.string() },
  handler: async (ctx, { from, to }) => {
    const [start, end] = [ms(from), ms(to)];
    const within = (value: number | undefined) => value !== undefined && value >= start && value <= end;
    const docs = await aliveTasks(ctx, ctx.user._id);
    return docs
      .filter((doc) => within(doc.dueDate) || within(doc.startDate))
      .sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity))
      .map(taskItem);
  },
});

/**
 * Búsqueda por lemas: la consulta pasa por el mismo lematizador que escribió
 * el campo, así que "escribiendo" encuentra "Escribir la escena del puente".
 */
export const search = kinoZodQuery({
  args: { query: z.string().min(1).max(200), systemId: zid('systems').optional() },
  handler: async (ctx, { query, systemId }) => {
    const lemas = lematizar(query);
    if (!lemas) return [];
    const docs = await ctx.db
      .query('tasks')
      .withSearchIndex('search_lemas', (q) => {
        const base = q.search('lemas', lemas).eq('userId', ctx.user._id).eq('deletedAt', undefined);
        return systemId ? base.eq('systemId', systemId) : base;
      })
      .take(50);
    return docs.map(taskItem);
  },
});

export const timeLogSummary = kinoZodQuery({
  args: { id: zid('tasks') },
  handler: async (ctx, { id }) => {
    await ownTask(ctx, ctx.user._id, id, { includeDeleted: true });
    const logs = await ctx.db
      .query('timeLogs')
      .withIndex('by_task', (q) => q.eq('taskId', id))
      .collect();
    return {
      totalMinutes: logs.reduce((sum, log) => sum + log.durationMinutes, 0),
      sessionCount: logs.length,
    };
  },
});

// ── Escrituras ──────────────────────────────────────────────────────────────

async function createOne(ctx: MutationCtx, userId: Id<'users'>, timezone: string, data: CreateTaskInput) {
  // Reintento de la cola offline: la misma petición devuelve la misma tarea.
  if (data.clientRequestId) {
    const existing = await ctx.db
      .query('tasks')
      .withIndex('by_user_clientRequest', (q) => q.eq('userId', userId).eq('clientRequestId', data.clientRequestId))
      .unique();
    if (existing) return existing;
  }

  const system = await ownSystem(ctx, userId, data.systemId);
  assertKind(system, data.metadata);
  if (data.parentTaskId) {
    const parent = await ctx.db.get(data.parentTaskId);
    if (!parent || parent.userId !== userId || !alive(parent)) notFound('Parent task not found');
  }
  await assertRefs(ctx, userId, data.systemId, data);

  const now = Date.now();
  const startDate = optMs(data.startDate);
  // Las ideas son capturas y viven en backlog; con fecha de inicio manda la fecha.
  const status: TaskStatus =
    data.status === 'done'
      ? 'done'
      : data.taskType === 'idea'
        ? 'backlog'
        : startDate !== undefined
          ? deriveStatusFromDate(startDate, timezone, now)
          : (data.status ?? 'backlog');

  const id = await ctx.db.insert('tasks', {
    userId,
    systemId: data.systemId,
    parentTaskId: data.parentTaskId,
    title: data.title,
    description: data.description,
    status,
    boardStatus: data.boardStatus,
    boardStatusChangedAt: data.boardStatus ? now : undefined,
    energyLevel: data.energyLevel ?? 'medium',
    priority: data.priority ?? 'medium',
    taskType: data.taskType,
    dueDate: optMs(data.dueDate),
    startDate,
    estimatedTime: data.estimatedTime?.slice(0, 5),
    recurrenceRule: data.recurrenceRule ?? undefined,
    folderId: data.folderId,
    contextTagId: data.contextTagId,
    sprintId: data.sprintId,
    clientRequestId: data.clientRequestId,
    sortIndex: 0,
    metadata: data.metadata,
    inTodayPlan: status === 'today',
    notifiedBeforeDay: false,
    notifiedDueDay: false,
    reminderCount: 0,
    lemas: lematizar(data.title, data.description),
    createdBy: userId,
    createdVia: 'session',
    createdAt: now,
    updatedAt: now,
  });
  const task = (await ctx.db.get(id))!;

  await syncAutoReminders(ctx, task, now);
  if (task.taskType === 'reminder' && task.dueDate !== undefined) {
    await ctx.db.insert('taskReminders', {
      taskId: id,
      userId,
      remindAt: task.dueDate,
      label: 'Recordatorio',
      source: 'auto',
      createdAt: now,
    });
  }
  return task;
}

export const create = kinoZodMutation({
  args: createTaskSchema,
  handler: async (ctx, data) => taskItem(await createOne(ctx, ctx.user._id, ctx.user.timezone, data)),
});

/** Exportada para la siembra del onboarding, que crea tareas sin pasar por el cliente. */
export const createTaskDoc = createOne;

export const bulkCreate = kinoZodMutation({
  args: { tasks: z.array(createTaskSchema).min(1).max(50) },
  handler: async (ctx, { tasks }) => {
    const created = [];
    for (const item of tasks) created.push(await createOne(ctx, ctx.user._id, ctx.user.timezone, item));
    return created.map(taskItem);
  },
});

export const update = kinoZodMutation({
  args: updateTaskSchema.extend({ id: zid('tasks') }),
  handler: async (ctx, { id, ...data }) => taskItem(await updateTaskDoc(ctx, ctx.user, id, data)),
});

/**
 * La edición de una tarea, exportada para que energía y el ritual escriban
 * `startDate` por el mismo camino que el calendario.
 */
export async function updateTaskDoc(
  ctx: MutationCtx,
  user: Doc<'users'>,
  id: Id<'tasks'>,
  data: z.infer<typeof updateTaskSchema>,
): Promise<TaskDoc> {
  {
    const userId = user._id;
    const current = await ownTask(ctx, userId, id);

    const targetSystemId = data.systemId ?? current.systemId;
    const targetSystem = await ownSystem(ctx, userId, targetSystemId);
    if (data.metadata) assertKind(targetSystem, data.metadata);
    if (data.parentTaskId) await assertValidParent(ctx, userId, id, data.parentTaskId);
    await assertRefs(ctx, userId, targetSystemId, data);

    const patch: Partial<TaskDoc> = { updatedAt: Date.now() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.energyLevel !== undefined) patch.energyLevel = data.energyLevel;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.taskType !== undefined) patch.taskType = data.taskType ?? undefined;
    if (data.estimatedTime !== undefined) patch.estimatedTime = data.estimatedTime.slice(0, 5);
    if (data.parentTaskId !== undefined) patch.parentTaskId = data.parentTaskId;
    if (data.contextTagId !== undefined) patch.contextTagId = data.contextTagId ?? undefined;
    if (data.sprintId !== undefined) patch.sprintId = data.sprintId ?? undefined;
    if (data.inTodayPlan !== undefined) patch.inTodayPlan = data.inTodayPlan;
    if (data.recurrenceRule !== undefined) patch.recurrenceRule = data.recurrenceRule ?? undefined;
    if (data.metadata !== undefined) patch.metadata = data.metadata ?? undefined;
    if (data.dueDate !== undefined) patch.dueDate = optMs(data.dueDate);
    if (data.startDate !== undefined) patch.startDate = optMs(data.startDate);
    if (data.systemId !== undefined) patch.systemId = data.systemId;
    // Al cambiar de sistema sin decir carpeta, la carpeta vieja no viaja.
    if ('folderId' in data) patch.folderId = data.folderId ?? undefined;
    else if (data.systemId && data.systemId !== current.systemId) patch.folderId = undefined;
    if (data.title !== undefined || data.description !== undefined) {
      patch.lemas = lematizar(data.title ?? current.title, data.description ?? current.description);
    }

    // El status se deriva de la fecha de inicio salvo que venga explícito o la
    // tarea ya esté hecha.
    if (data.status !== undefined) {
      patch.status = data.status;
    } else if ((data.startDate !== undefined || data.taskType !== undefined) && current.status !== 'done') {
      const effectiveType = data.taskType === undefined ? current.taskType : data.taskType;
      if (effectiveType === 'idea') patch.status = 'backlog';
      else if (data.startDate !== undefined) patch.status = deriveStatusFromDate(optMs(data.startDate), user.timezone);
    }

    const dueChanged = data.dueDate !== undefined && optMs(data.dueDate) !== current.dueDate;
    if (dueChanged) {
      Object.assign(patch, { notifiedBeforeDay: false, notifiedDueDay: false, reminderCount: 0, lastRemindedAt: undefined });
    }

    await ctx.db.patch(id, patch);
    const task = (await ctx.db.get(id))!;
    if (dueChanged || data.priority !== undefined) await syncAutoReminders(ctx, task, Date.now());
    return task;
  }
}

export const remove = kinoZodMutation({
  args: { id: zid('tasks') },
  handler: async (ctx, { id }) => {
    await ownTask(ctx, ctx.user._id, id);
    await ctx.db.patch(id, { deletedAt: Date.now() });
    return null;
  },
});

export const restore = kinoZodMutation({
  args: { id: zid('tasks') },
  handler: async (ctx, { id }) => {
    await ownTask(ctx, ctx.user._id, id, { includeDeleted: true });
    await ctx.db.patch(id, { deletedAt: undefined });
    return taskItem((await ctx.db.get(id))!);
  },
});

/** Completar la madre no completa a las hijas: cada subtarea guarda su estado. */
export const toggle = kinoZodMutation({
  args: { id: zid('tasks') },
  handler: async (ctx, { id }) => {
    const task = await ownTask(ctx, ctx.user._id, id);
    const updated = await applyTransition(ctx, task, (current) =>
      current.status === 'done' ? 'undo_done' : 'toggle_done',
    );
    return { status: updated.status };
  },
});

const moveTo = (status: TaskStatus) => (current: TaskDoc) => {
  if (current.status === status) return null;
  const action = actionForTransition(current.status, status);
  if (!action) invalid(`Cannot move task from '${current.status}' to '${status}'`);
  return action;
};

export const move = kinoZodMutation({
  args: { id: zid('tasks'), status: z.enum(['backlog', 'week', 'tomorrow', 'today', 'done']) },
  handler: async (ctx, { id, status }) => {
    const task = await ownTask(ctx, ctx.user._id, id);
    return taskItem(await applyTransition(ctx, task, moveTo(status)));
  },
});

export const bulkMove = kinoZodMutation({
  args: {
    taskIds: z.array(zid('tasks')).min(1).max(50),
    status: z.enum(['backlog', 'week', 'tomorrow', 'today', 'done']),
  },
  handler: async (ctx, { taskIds, status }) => {
    for (const id of taskIds) {
      const task = await ownTask(ctx, ctx.user._id, id);
      await applyTransition(ctx, task, moveTo(status));
    }
    return null;
  },
});

export const bulkUpdate = kinoZodMutation({
  args: {
    taskIds: z.array(zid('tasks')).min(1).max(50),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  },
  handler: async (ctx, { taskIds, priority }) => {
    if (priority === undefined) return null;
    const now = Date.now();
    for (const id of taskIds) {
      const task = await ownTask(ctx, ctx.user._id, id);
      await ctx.db.patch(task._id, { priority, updatedAt: now });
      await syncAutoReminders(ctx, { ...task, priority }, now);
    }
    return null;
  },
});

/**
 * Mueve una tarjeta de columna del tablero. La columna tiene que existir para
 * el tipo del sistema, y la terminal completa o descompleta la tarea.
 */
export const moveBoard = kinoZodMutation({
  args: { id: zid('tasks'), boardStatus: z.string().min(1).max(50) },
  handler: async (ctx, { id, boardStatus }) => {
    const task = await ownTask(ctx, ctx.user._id, id);
    const system = await ownSystem(ctx, ctx.user._id, task.systemId);
    const column = await ctx.db
      .query('systemStatusDefinitions')
      .withIndex('by_type_status', (q) => q.eq('systemType', system.templateType).eq('statusName', boardStatus))
      .unique();
    if (!column) invalid(`Invalid board column '${boardStatus}' for this system`);

    const now = Date.now();
    await ctx.db.patch(id, { boardStatus, boardStatusChangedAt: now, updatedAt: now });
    const bridge = deriveBoardBridgeAction(task.status, task.boardStatus ?? null, boardStatus);
    const moved = (await ctx.db.get(id))!;
    return taskItem(bridge ? await applyTransition(ctx, moved, () => bridge) : moved);
  },
});

/** La posición de cada id es su nuevo `sortIndex`. Los ajenos se ignoran. */
export const reorder = kinoZodMutation({
  args: { ids: z.array(zid('tasks')).min(1) },
  handler: async (ctx, { ids }) => {
    const now = Date.now();
    for (const [index, id] of ids.entries()) {
      const task = await ctx.db.get(id);
      if (!task || task.userId !== ctx.user._id || !alive(task)) continue;
      await ctx.db.patch(id, { sortIndex: index, updatedAt: now });
    }
    return null;
  },
});

export const createTimeLog = kinoZodMutation({
  args: createTimeLogSchema,
  handler: async (ctx, { id, ...data }) => {
    const task = await ownTask(ctx, ctx.user._id, id, { includeDeleted: true });
    if (data.systemId !== task.systemId) invalid('systemId does not match the task');
    await ctx.db.insert('timeLogs', {
      userId: ctx.user._id,
      taskId: id,
      systemId: data.systemId,
      startedAt: ms(data.startedAt),
      endedAt: ms(data.endedAt),
      durationMinutes: data.durationMinutes,
      source: data.source,
      createdAt: Date.now(),
    });
    return null;
  },
});

// ── El plan de hoy ──────────────────────────────────────────────────────────

/**
 * Recoloca el estado de planificación de cada tarea viva según su fecha de
 * inicio: lo de mañana pasa a hoy, lo de hoy de ayer sale. Las ideas y lo
 * hecho no se tocan.
 */
async function reconcileStatuses(ctx: MutationCtx, docs: TaskDoc[], timezone: string, now: number) {
  for (const doc of docs) {
    if (doc.status === 'done' || doc.taskType === 'idea') continue;
    const status = deriveStatusFromDate(doc.startDate, timezone, now);
    if (status !== doc.status) await ctx.db.patch(doc._id, { status, updatedAt: now });
  }
}

/**
 * Rollover diario del plan de hoy. Si la marca `todayPlanDate` es de otro día:
 * reconcilia estados, vacía el plan anterior, lo repuebla con lo que empieza
 * hoy y guarda la marca. Dentro del mismo día no toca nada.
 */
export const rollTodayPlan = kinoZodMutation({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', ctx.user._id))
      .unique();
    if (!settings) return { rolled: false };
    const now = Date.now();
    const today = userToday(ctx.user.timezone, now);
    if (settings.todayPlanDate !== undefined && settings.todayPlanDate >= today) return { rolled: false };

    const docs = await aliveTasks(ctx, ctx.user._id);
    await reconcileStatuses(ctx, docs, ctx.user.timezone, now);
    for (const doc of docs) {
      const startsToday =
        topLevel(doc) &&
        doc.status !== 'done' &&
        doc.startDate !== undefined &&
        calendarDayInTz(doc.startDate, ctx.user.timezone) === today;
      const current = (await ctx.db.get(doc._id))!;
      if (current.inTodayPlan !== startsToday) await ctx.db.patch(doc._id, { inTodayPlan: startsToday, updatedAt: now });
    }
    await ctx.db.patch(settings._id, { todayPlanDate: today, updatedAt: now });
    return { rolled: true };
  },
});
