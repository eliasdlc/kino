import { NextResponse } from "next/server";
import { route } from "@/shared/utils/route";
import { NotFoundError } from "@/shared/utils/error";
import {
  bulkMoveSchema,
  bulkUpdateSchema,
  bulkCreateTaskSchema,
  listTasksQueryParamsSchema,
  createTaskSchema,
  moveTaskSchema,
  moveBoardSchema,
  reorderTasksSchema,
  updateTaskSchema,
  createTimeLogSchema,
} from "./tasks.schemas";
import {
  bulkMoveTasks,
  bulkUpdateTasks,
  bulkCreateTasks,
  queryTasks,
  createTask,
  deleteTask,
  getSubtasks,
  getTaskById,
  getTasksBySystem,
  moveTask,
  moveTaskBoard,
  reorderTasks,
  restoreTask,
  toggleTask,
  updateTask,
  createTimeLog,
  getTimeLogSummary,
  ensureTodayPlanRolled,
} from "./tasks.service";
import type { TaskStatus } from "./tasks.state-machine";
import { getSystemById } from "@/features/systems/systems.service";

type IdParam = { id: string };

// GET /api/systems/[id]/tasks
export const GET = route<IdParam>()({}, async ({ userId, params }) => {
  // Rollover + reconcile diario lazy (gated 1×/día) antes de leer.
  await ensureTodayPlanRolled(userId);
  const system = await getSystemById(params.id, userId);
  if (!system) throw new NotFoundError("System not found");
  return NextResponse.json(await getTasksBySystem(params.id, userId));
});

// GET /api/tasks/[id]
export const getById = route<IdParam>()({}, async ({ userId, params }) => {
  const task = await getTaskById(params.id, userId);
  if (!task) throw new NotFoundError("Task not found");
  return NextResponse.json(task);
});

// GET /api/tasks
export const listTasks = route()(
  { query: listTasksQueryParamsSchema },
  async ({ userId, query }) => {
    // Rollover + reconcile diario lazy (gated 1×/día) antes de leer.
    await ensureTodayPlanRolled(userId);
    return NextResponse.json(await queryTasks(userId, query));
  },
);

// POST /api/tasks/bulk-create
export const postBulkCreate = route()(
  { body: bulkCreateTaskSchema },
  async ({ userId, body }) =>
    NextResponse.json(await bulkCreateTasks(userId, body.tasks), { status: 201 }),
);

// POST /api/tasks
export const POST = route()({ body: createTaskSchema }, async ({ userId, body }) =>
  NextResponse.json(await createTask(userId, body), { status: 201 }),
);

// PATCH/DELETE /api/tasks/[id]
export const PATCH = route<IdParam>()(
  { body: updateTaskSchema },
  async ({ userId, params, body }) => {
    const task = await updateTask(params.id, userId, body);
    if (!task) throw new NotFoundError("Task not found");
    return NextResponse.json(task);
  },
);

export const DELETE = route<IdParam>()({}, async ({ userId, params }) => {
  await deleteTask(params.id, userId);
  return new NextResponse(null, { status: 204 });
});

// POST /api/tasks/[id]/toggle
export const postToggle = route<IdParam>()({}, async ({ userId, params }) =>
  NextResponse.json(await toggleTask(params.id, userId)),
);

// PATCH /api/tasks/[id]/move
export const patchMove = route<IdParam>()(
  { body: moveTaskSchema },
  async ({ userId, params, body }) =>
    NextResponse.json(await moveTask(params.id, body.status as TaskStatus, userId)),
);

// PATCH /api/tasks/[id]/board
export const patchBoardMove = route<IdParam>()(
  { body: moveBoardSchema },
  async ({ userId, params, body }) =>
    NextResponse.json(await moveTaskBoard(params.id, body.boardStatus, userId)),
);

// GET /api/tasks/[id]/subtasks
export const getSubtasksRoute = route<IdParam>()({}, async ({ userId, params }) =>
  NextResponse.json(await getSubtasks(params.id, userId)),
);

// POST /api/tasks/[id]/restore
export const postRestore = route<IdParam>()({}, async ({ userId, params }) =>
  NextResponse.json(await restoreTask(params.id, userId)),
);

// POST /api/tasks/bulk-move
export const postBulkMove = route()({ body: bulkMoveSchema }, async ({ userId, body }) => {
  await bulkMoveTasks(body.taskIds, body.status as TaskStatus, userId);
  return new NextResponse(null, { status: 204 });
});

// PATCH /api/tasks/bulk-update
export const patchBulkUpdate = route()(
  { body: bulkUpdateSchema },
  async ({ userId, body }) => {
    await bulkUpdateTasks(body.taskIds, { priority: body.priority }, userId);
    return new NextResponse(null, { status: 204 });
  },
);

// POST /api/tasks/reorder
export const postReorder = route()({ body: reorderTasksSchema }, async ({ userId, body }) => {
  await reorderTasks(userId, body.ids);
  return new NextResponse(null, { status: 204 });
});

// GET/POST /api/tasks/[id]/time-logs
export const getTimeLogSummaryRoute = route<IdParam>()({}, async ({ userId, params }) =>
  NextResponse.json(await getTimeLogSummary(params.id, userId)),
);

export const postTimeLog = route<IdParam>()(
  { body: createTimeLogSchema },
  async ({ userId, params, body }) => {
    await createTimeLog(params.id, userId, body);
    return new NextResponse(null, { status: 201 });
  },
);
