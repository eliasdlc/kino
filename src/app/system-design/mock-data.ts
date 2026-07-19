import type { Task } from "@/features/tasks/tasks.types";
import type { SystemWithSignals } from "@/features/systems/systems.types";

/**
 * Datos de muestra para el catálogo visual. Los componentes compuestos de Kino
 * (SystemCard, task cards…) consumen filas reales de la DB; aquí las fabricamos
 * completas para que cada estado visual sea reproducible sin datos reales.
 */

const NOW = new Date("2026-07-15T12:00:00Z");
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const MOCK_SYSTEM_ID = uuid(1);

export function makeTask(overrides: Partial<Task> = {}): Task {
  const base: Task = {
    id: uuid(100),
    userId: uuid(2),
    systemId: MOCK_SYSTEM_ID,
    parentTaskId: null,
    title: "Preparar entrega de diseño",
    description: null,
    status: "today",
    boardStatus: null,
    boardStatusChangedAt: null,
    energyLevel: "medium",
    priority: "medium",
    taskType: "task",
    dueDate: null,
    startDate: null,
    estimatedTime: null,
    recurrenceRule: null,
    recurrenceParentId: null,
    folderId: null,
    contextTagId: null,
    sprintId: null,
    externalSource: null,
    externalId: null,
    sortIndex: 0,
    metadata: null,
    inTodayPlan: false,
    notifiedBeforeDay: false,
    notifiedDueDay: false,
    reminderCount: 0,
    lastRemindedAt: null,
    completedAt: null,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  } as Task;
  return { ...base, ...overrides };
}

export function makeSystem(overrides: Partial<SystemWithSignals> = {}): SystemWithSignals {
  const base: SystemWithSignals = {
    id: uuid(1),
    userId: uuid(2),
    name: "Universidad",
    color: "blue",
    identityStatement: null,
    templateType: "academic",
    energyIdeal: null,
    icon: "book",
    isActive: true,
    isInbox: false,
    expectedFrequency: null,
    triggerContext: null,
    metadata: null,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    stale: false,
    daysSinceLastActivity: 1,
    activeTaskCount: 8,
  } as SystemWithSignals;
  return { ...base, ...overrides };
}
