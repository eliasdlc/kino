import type { Doc } from '../../_generated/dataModel';
import type { Task } from '../../../src/features/tasks/tasks.types';

/**
 * El documento de Convex con la forma de la fila de Postgres: fechas como
 * `Date`, ausencias como `null`, `dueDate` y `startDate` como texto ISO. Es lo
 * que los módulos puros de energía e insights reciben, y así no cambian.
 */
export function toTaskRow(doc: Doc<'tasks'>): Task {
  const date = (ms: number | undefined) => (ms === undefined ? null : new Date(ms));
  const isoOrNull = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());
  return {
    id: doc._id,
    userId: doc.userId,
    systemId: doc.systemId,
    parentTaskId: doc.parentTaskId ?? null,
    title: doc.title,
    description: doc.description ?? null,
    status: doc.status,
    boardStatus: doc.boardStatus ?? null,
    boardStatusChangedAt: date(doc.boardStatusChangedAt),
    energyLevel: doc.energyLevel,
    priority: doc.priority,
    taskType: doc.taskType ?? null,
    dueDate: isoOrNull(doc.dueDate),
    startDate: isoOrNull(doc.startDate),
    estimatedTime: doc.estimatedTime === undefined ? null : `${doc.estimatedTime}:00`,
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
    lastRemindedAt: date(doc.lastRemindedAt),
    completedAt: date(doc.completedAt),
    deletedAt: date(doc.deletedAt),
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
  };
}
