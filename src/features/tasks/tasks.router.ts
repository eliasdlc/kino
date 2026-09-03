import { implement } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { getSystemById } from "@/features/systems/systems.service";
import { tasksContract } from "./tasks.contract";
import {
  bulkCreateTasks,
  bulkMoveTasks,
  bulkUpdateTasks,
  createTask,
  createTimeLog,
  deleteTask,
  ensureTodayPlanRolled,
  getScheduledTasks,
  getSubtasks,
  getTaskById,
  getTasksByFolder,
  getTasksBySystem,
  getTimeLogSummary,
  getTodayPlan,
  moveTask,
  moveTaskBoard,
  queryTasks,
  reorderTasks,
  restoreTask,
  toggleTask,
  updateTask,
} from "./tasks.service";
import type { TaskStatus } from "./tasks.state-machine";

const os = implement(tasksContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

/**
 * La implementación del contrato de `tasks`. Cada handler es la llamada al
 * servicio y nada más: la credencial, el permiso, la validación de la entrada y
 * la traducción de los errores ya ocurrieron antes de llegar aquí.
 */
export const tasksRouter = os.router({
  list: os.list.handler(async ({ context, input }) => {
    // Rollover + reconcile diario lazy (gated 1×/día) antes de leer.
    await ensureTodayPlanRolled(context.userId);
    return queryTasks(context.userId, input);
  }),

  create: os.create.handler(async ({ context, input }) => {
    const task = await createTask(context.userId, input);
    // `createTask` sólo devuelve null cuando un reintento con `clientRequestId`
    // choca con una fila que después no aparece, y eso no puede pasar dentro de
    // la misma transacción. Si pasara, es un fallo del servidor, no una tarea.
    if (!task) throw new Error("createTask no devolvió fila");
    return task;
  }),

  bulkCreate: os.bulkCreate.handler(({ context, input }) =>
    bulkCreateTasks(context.userId, input.tasks),
  ),

  bulkMove: os.bulkMove.handler(async ({ context, input }) => {
    await bulkMoveTasks(input.taskIds, input.status as TaskStatus, context.userId);
  }),

  bulkUpdate: os.bulkUpdate.handler(async ({ context, input }) => {
    await bulkUpdateTasks(input.taskIds, { priority: input.priority }, context.userId);
  }),

  reorder: os.reorder.handler(async ({ context, input }) => {
    await reorderTasks(context.userId, input.ids);
  }),

  calendar: os.calendar.handler(async ({ context, input }) => {
    await ensureTodayPlanRolled(context.userId);
    return getScheduledTasks(context.userId, input.from, input.to);
  }),

  todayPlan: os.todayPlan.handler(async ({ context }) => {
    // Rollover diario lazy: resetea y repuebla el plan si es de un día anterior.
    await ensureTodayPlanRolled(context.userId);
    return getTodayPlan(context.userId);
  }),

  byId: os.byId.handler(async ({ context, input }) => {
    const task = await getTaskById(input.id, context.userId);
    if (!task) throw new NotFoundError("Task not found");
    return task;
  }),

  update: os.update.handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const task = await updateTask(id, context.userId, data);
    if (!task) throw new NotFoundError("Task not found");
    return task;
  }),

  remove: os.remove.handler(async ({ context, input }) => {
    await deleteTask(input.id, context.userId);
  }),

  toggle: os.toggle.handler(({ context, input }) => toggleTask(input.id, context.userId)),

  move: os.move.handler(({ context, input }) =>
    moveTask(input.id, input.status as TaskStatus, context.userId),
  ),

  moveBoard: os.moveBoard.handler(({ context, input }) =>
    moveTaskBoard(input.id, input.boardStatus, context.userId),
  ),

  restore: os.restore.handler(({ context, input }) => restoreTask(input.id, context.userId)),

  subtasks: os.subtasks.handler(({ context, input }) => getSubtasks(input.id, context.userId)),

  timeLogSummary: os.timeLogSummary.handler(({ context, input }) =>
    getTimeLogSummary(input.id, context.userId),
  ),

  createTimeLog: os.createTimeLog.handler(async ({ context, input }) => {
    const { id, ...data } = input;
    await createTimeLog(id, context.userId, data);
  }),

  bySystem: os.bySystem.handler(async ({ context, input }) => {
    await ensureTodayPlanRolled(context.userId);
    const system = await getSystemById(input.systemId, context.userId);
    if (!system) throw new NotFoundError("System not found");
    return getTasksBySystem(input.systemId, context.userId);
  }),

  byFolder: os.byFolder.handler(({ context, input }) =>
    getTasksByFolder(input.folderId, input.systemId, context.userId),
  ),
});
