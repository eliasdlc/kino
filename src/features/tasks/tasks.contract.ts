import { z } from "zod";
import { type } from "@orpc/contract";
import { endpoint } from "@/shared/api/contract";
import { toTransport } from "@/shared/api/transport";
import type { Task, TaskTransport } from "./tasks.types";
import {
  bulkCreateTaskSchema,
  bulkMoveSchema,
  bulkUpdateSchema,
  calendarRangeSchema,
  createTaskSchema,
  createTimeLogSchema,
  listTasksQueryParamsSchema,
  moveBoardSchema,
  moveTaskSchema,
  reorderTasksSchema,
  updateTaskSchema,
} from "./tasks.schemas";

/**
 * El contrato de `tasks`: qué entra, qué sale y por qué URL, en un solo sitio.
 *
 * La entrada ya estaba declarada — son los mismos schemas de `tasks.schemas.ts`,
 * sin reescribir. Lo que faltaba es la salida, que hasta ahora era lo que
 * devolviera el servicio y el cliente afirmaba con un cast.
 *
 * Por qué `type<Task, TaskTransport>(toTransport)` y no un Zod para la salida:
 * el tipo de la salida se deriva de la tabla, así que una columna nueva aparece
 * sola en el cliente en vez de exigir que alguien la copie. Y como la fila y su
 * forma de transporte no son el mismo tipo, el compilador obliga a que exista la
 * conversión: no se puede declarar que sale texto ISO y devolver un `Date`.
 * Las salidas que no son filas de una tabla sí llevan su Zod, escrito a mano
 * porque no hay nada de donde derivarlas.
 *
 * Las rutas con params llevan el param dentro del schema de entrada: oRPC lo
 * saca de la URL y deja el resto en el body, que es lo que `prepareBody` hacía
 * a mano en `route()`.
 */

const task = () => type<Task, TaskTransport>(toTransport);
/** Sin cuerpo: un 204 no devuelve nada, y el tipo lo dice en vez de `unknown`. */
const nothing = () => type<void>();
const taskList = () => type<Task[], TaskTransport[]>(toTransport);

const idParam = z.object({ id: z.string().uuid() });
const id = { id: z.string().uuid() };

export const tasksContract = {
  list: endpoint
    .route({ method: "GET", path: "/tasks" })
    .input(listTasksQueryParamsSchema)
    .output(taskList()),

  create: endpoint
    .route({ method: "POST", path: "/tasks", successStatus: 201 })
    .input(createTaskSchema)
    .output(task()),

  bulkCreate: endpoint
    .route({ method: "POST", path: "/tasks/bulk", successStatus: 201 })
    .input(bulkCreateTaskSchema)
    .output(taskList()),

  bulkMove: endpoint
    .route({ method: "POST", path: "/tasks/bulk-move", successStatus: 204 })
    .input(bulkMoveSchema)
    .output(nothing()),

  bulkUpdate: endpoint
    .route({ method: "PATCH", path: "/tasks/bulk-update", successStatus: 204 })
    .input(bulkUpdateSchema)
    .output(nothing()),

  reorder: endpoint
    .route({ method: "POST", path: "/tasks/reorder", successStatus: 204 })
    .input(reorderTasksSchema)
    .output(nothing()),

  calendar: endpoint
    .route({ method: "GET", path: "/tasks/calendar" })
    .input(calendarRangeSchema)
    .output(taskList()),

  todayPlan: endpoint
    .route({ method: "GET", path: "/tasks/today-plan" })
    .output(taskList()),

  byId: endpoint
    .route({ method: "GET", path: "/tasks/{id}" })
    .input(idParam)
    .output(task()),

  update: endpoint
    .route({ method: "PATCH", path: "/tasks/{id}" })
    .input(updateTaskSchema.extend(id))
    .output(task()),

  remove: endpoint
    .route({ method: "DELETE", path: "/tasks/{id}", successStatus: 204 })
    .input(idParam)
    .output(nothing()),

  // Devuelve sólo el status resultante, no la tarea: es lo que la transición
  // decide y lo único que el cliente necesita para pintar el cambio.
  toggle: endpoint
    .route({ method: "POST", path: "/tasks/{id}/toggle" })
    .input(idParam)
    .output(z.object({ status: z.string() })),

  move: endpoint
    .route({ method: "PATCH", path: "/tasks/{id}/move" })
    .input(moveTaskSchema.extend(id))
    .output(task()),

  moveBoard: endpoint
    .route({ method: "PATCH", path: "/tasks/{id}/board" })
    .input(moveBoardSchema.extend(id))
    .output(task()),

  restore: endpoint
    .route({ method: "POST", path: "/tasks/{id}/restore" })
    .input(idParam)
    .output(task()),

  subtasks: endpoint
    .route({ method: "GET", path: "/tasks/{id}/subtasks" })
    .input(idParam)
    .output(taskList()),

  timeLogSummary: endpoint
    .route({ method: "GET", path: "/tasks/{id}/time-logs" })
    .input(idParam)
    .output(z.object({ totalMinutes: z.number(), sessionCount: z.number() })),

  createTimeLog: endpoint
    .route({ method: "POST", path: "/tasks/{id}/time-log", successStatus: 201 })
    .input(createTimeLogSchema.extend(id))
    .output(nothing()),

  bySystem: endpoint
    .route({ method: "GET", path: "/systems/{systemId}/tasks" })
    .input(z.object({ systemId: z.string().uuid() }))
    .output(taskList()),

  byFolder: endpoint
    .route({ method: "GET", path: "/systems/{systemId}/folders/{folderId}/tasks" })
    .input(z.object({ systemId: z.string().uuid(), folderId: z.string().uuid() }))
    .output(taskList()),
};
