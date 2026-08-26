import { type TaskTransport, type CreateTaskInput } from "./tasks.types";
import { deriveStatusFromDate } from "./tasks.utils";

/**
 * Construye la tarea optimista a partir de las variables de la mutación.
 *
 * Vive fuera del hook porque la captura offline (KIN-57) necesita poder
 * reconstruirla **sin componente montado**: al reabrir la app, la cola persistida
 * sólo conserva las variables, y de ellas tiene que salir exactamente el mismo
 * placeholder que se vio antes de cerrar. Por eso es una función pura de `data` y
 * por eso el id sale del `clientRequestId` en vez de un uuid nuevo cada vez.
 */
export function buildOptimisticTask(data: CreateTaskInput): TaskTransport {
  // Status optimista: reusa el único helper del backend (FE-03) en vez de
  // reimplementar la derivación. La tz del navegador refleja lo que el
  // usuario ve; el servidor recalcula con la tz de la cuenta al confirmar.
  const optimisticStatus = deriveStatusFromDate(
    data.startDate,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  return {
    // El id del placeholder ES el clientRequestId (ver `reconcile.ts`): estable
    // entre reinicios y suficiente para saber qué sigue pendiente de subir.
    id: data.clientRequestId ?? crypto.randomUUID(),
    title: data.title,
    description: data.description ?? null,
    status: optimisticStatus,
    boardStatus: null,
    boardStatusChangedAt: null,
    priority: (data.priority as TaskTransport["priority"]) ?? "medium",
    energyLevel: (data.energyLevel as TaskTransport["energyLevel"]) ?? "medium",
    taskType: (data.taskType as TaskTransport["taskType"]) ?? null,
    dueDate: data.dueDate ?? null,
    startDate: data.startDate ?? null,
    estimatedTime: data.estimatedTime ?? null,
    parentTaskId: data.parentTaskId ?? null,
    contextTagId: data.contextTagId ?? null,
    folderId: data.folderId ?? null,
    sprintId: null,
    systemId: data.systemId,
    userId: "optimistic",
    recurrenceRule: data.recurrenceRule ?? null,
    recurrenceParentId: null,
    externalSource: null,
    externalId: null,
    clientRequestId: data.clientRequestId ?? null,
    sortIndex: 0,
    metadata: null,
    inTodayPlan: false,
    notifiedBeforeDay: false,
    notifiedDueDay: false,
    reminderCount: 0,
    lastRemindedAt: null,
    // Texto ISO y no `Date`: el placeholder tiene que ser indistinguible de lo
    // que devuelve el servidor, o al confirmarse la fila cambiaría de forma.
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    deletedAt: null,
  };
}
