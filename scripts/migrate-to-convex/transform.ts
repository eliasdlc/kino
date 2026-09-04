// De una fila de Postgres, tal como la lee Drizzle, al documento de Convex que
// el schema acepta. Puro: ni base ni red. La correspondencia de ids la aporta
// quien llama en `Refs`, tabla a tabla y en el orden de las referencias.

import type { WithoutSystemFields } from 'convex/server';
import type { VLiteral, VUnion } from 'convex/values';
import type { Doc, Id, TableNames } from '../../convex/_generated/dataModel';
import { lematizar } from '../../convex/lib/lemas';
import {
  checkinSlot,
  chronotype,
  color,
  energyLevel,
  entityType,
  predictionAccuracy,
  profileType,
  reminderSource,
  sleepQuality,
  sprintStatus,
  syncProvider,
  taskPriority,
  taskStatus,
  taskType,
  templateType,
  timeSource,
  uiTheme,
  weekday,
  accountStatus,
} from '../../convex/schema';
import type * as pg from '../../src/shared/db/schema';

export type Insert<T extends TableNames> = WithoutSystemFields<Doc<T>>;
type Row<T extends { $inferSelect: unknown }> = T['$inferSelect'];

/** Ids de Convex ya asignados, por tabla y por id de Postgres. */
export class Refs {
  constructor(private readonly maps: Partial<Record<TableNames, Map<string, string>>> = {}) {}

  set(table: TableNames, entries: { pgId: string; id: string }[]) {
    this.maps[table] = new Map(entries.map(({ pgId, id }) => [pgId, id]));
  }

  add(table: TableNames, pgId: string, id: string) {
    (this.maps[table] ??= new Map()).set(pgId, id);
  }

  /** Referencia obligatoria: una fila sin destino es un dato roto. */
  id<T extends TableNames>(table: T, pgId: string): Id<T> {
    const id = this.maps[table]?.get(pgId);
    if (!id) throw new Error(`${table}: no hay documento para el id de Postgres ${pgId}`);
    return id as Id<T>;
  }

  /** Referencia opcional: null en Postgres es ausencia en Convex. */
  opt<T extends TableNames>(table: T, pgId: string | null): Id<T> | undefined {
    return pgId === null ? undefined : this.id(table, pgId);
  }

  /**
   * Referencia a la propia tabla. En la primera pasada la tabla todavía no
   * existe en Convex y la referencia se deja vacía; la segunda pasada la
   * rellena.
   */
  self<T extends TableNames>(table: T, pgId: string | null): Id<T> | undefined {
    if (pgId === null) return undefined;
    return this.maps[table]?.get(pgId) as Id<T> | undefined;
  }
}

/** Tablas que se refieren a sí mismas y por eso se importan en dos pasadas. */
export const SELF_REFERENCING: TableNames[] = ['tasks', 'folders', 'pages'];

// ── Conversores de tipo ─────────────────────────────────────────────────────

const ms = (value: Date | string): number => {
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  if (Number.isNaN(time)) throw new Error(`Fecha ilegible: ${String(value)}`);
  return time;
};
const optMs = (value: Date | string | null): number | undefined =>
  value === null ? undefined : ms(value);
const opt = <T>(value: T | null): T | undefined => (value === null ? undefined : value);
/** 'HH:MM:SS' de Postgres → 'HH:MM'. */
const clock = (value: string): string => value.slice(0, 5);
const optClock = (value: string | null): string | undefined =>
  value === null ? undefined : clock(value);

type LiteralUnion = VUnion<string, VLiteral<string>[], 'required', never>;
/** Comprueba que el valor está en el enum del schema de Convex y lo tipa. */
function oneOf<V extends LiteralUnion>(validator: V, value: string): V['type'] {
  const allowed = validator.members.map((member) => member.value);
  if (!allowed.includes(value)) {
    throw new Error(`Valor fuera del enum: ${value} (esperaba ${allowed.join(', ')})`);
  }
  return value;
}
const optOneOf = <V extends LiteralUnion>(validator: V, value: string | null) =>
  value === null ? undefined : oneOf(validator, value);

const jsonObject = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

// ── Cuenta ──────────────────────────────────────────────────────────────────

/** Better Auth se queda atrás: emailVerified, provider y providerId no viajan. */
export function user(row: Row<typeof pg.users>): Insert<'users'> {
  return {
    pgId: row.id,
    email: row.email,
    name: row.name,
    image: opt(row.image),
    onboardingCompleted: row.onboardingCompleted,
    status: oneOf(accountStatus, row.status),
    timezone: row.timezone,
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function userSettings(row: Row<typeof pg.userSettings>, refs: Refs): Insert<'userSettings'> {
  return {
    userId: refs.id('users', row.userId),
    profileType: optOneOf(profileType, row.profileType),
    archetypeIdentity: opt(row.archetypeIdentity),
    onboardingVersion: row.onboardingVersion,
    weeklyReviewDay: oneOf(weekday, row.weeklyReviewDay),
    dailyResetTime: clock(row.dailyResetTime),
    todayPlanDate: opt(row.todayPlanDate),
    dailyEnergyLimit: row.dailyEnergyLimit,
    focusTimeoutHours: row.focusTimeoutHours,
    theme: oneOf(uiTheme, row.theme),
    notificationsEnabled: row.notificationsEnabled,
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function userEnergyProfile(
  row: Row<typeof pg.userEnergyProfile>,
  refs: Refs,
): Insert<'userEnergyProfile'> {
  const presets: unknown = JSON.parse(row.rechargePresets);
  const curve: unknown = JSON.parse(row.learnedCurve);
  if (!Array.isArray(presets) || !Array.isArray(curve)) {
    throw new Error(`Perfil de energía con JSON que no es lista: ${row.userId}`);
  }
  return {
    userId: refs.id('users', row.userId),
    chronotype: oneOf(chronotype, row.chronotype),
    sleepTypicalHours: row.sleepTypicalHours,
    availableHoursPerDay: row.availableHoursPerDay,
    energyFloor: row.energyFloor,
    rechargePresets: presets.map((preset) => jsonObject(preset) ?? {}),
    learnedCurve: curve.map(Number),
    learningAlpha: row.learningAlpha,
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

// ── Trabajo ─────────────────────────────────────────────────────────────────

export function system(row: Row<typeof pg.systems>, refs: Refs): Insert<'systems'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    name: row.name,
    color: oneOf(color, row.color),
    identityStatement: opt(row.identityStatement),
    templateType: oneOf(templateType, row.templateType),
    energyIdeal: optOneOf(energyLevel, row.energyIdeal),
    icon: row.icon,
    isActive: row.isActive,
    isInbox: row.isInbox,
    expectedFrequency: opt(row.expectedFrequency),
    triggerContext: opt(row.triggerContext),
    metadata: jsonObject(row.metadata),
    sortOrder: row.sortOrder,
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function task(row: Row<typeof pg.tasks>, refs: Refs): Insert<'tasks'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    systemId: refs.id('systems', row.systemId),
    parentTaskId: refs.self('tasks', row.parentTaskId),
    title: row.title,
    description: opt(row.description),
    status: oneOf(taskStatus, row.status),
    boardStatus: opt(row.boardStatus),
    boardStatusChangedAt: optMs(row.boardStatusChangedAt),
    energyLevel: oneOf(energyLevel, row.energyLevel),
    priority: oneOf(taskPriority, row.priority),
    taskType: optOneOf(taskType, row.taskType),
    dueDate: optMs(row.dueDate),
    startDate: optMs(row.startDate),
    estimatedTime: optClock(row.estimatedTime),
    recurrenceRule: opt(row.recurrenceRule),
    recurrenceParentId: refs.self('tasks', row.recurrenceParentId),
    folderId: refs.opt('folders', row.folderId),
    contextTagId: refs.opt('contextTags', row.contextTagId),
    sprintId: refs.opt('sprints', row.sprintId),
    externalSource: opt(row.externalSource),
    externalId: opt(row.externalId),
    clientRequestId: opt(row.clientRequestId),
    sortIndex: row.sortIndex,
    metadata: jsonObject(row.metadata),
    inTodayPlan: row.inTodayPlan,
    notifiedBeforeDay: row.notifiedBeforeDay,
    notifiedDueDay: row.notifiedDueDay,
    reminderCount: row.reminderCount,
    lastRemindedAt: optMs(row.lastRemindedAt),
    completedAt: optMs(row.completedAt),
    deletedAt: optMs(row.deletedAt),
    lemas: lematizar(row.title, row.description),
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function sprint(row: Row<typeof pg.sprints>, refs: Refs): Insert<'sprints'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    systemId: refs.id('systems', row.systemId),
    name: row.name,
    goal: opt(row.goal),
    startDate: optMs(row.startDate),
    endDate: optMs(row.endDate),
    status: oneOf(sprintStatus, row.status),
    completedAt: optMs(row.completedAt),
    sortOrder: row.sortOrder,
    externalId: opt(row.externalId),
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function contextTag(row: Row<typeof pg.contextTags>, refs: Refs): Insert<'contextTags'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    systemId: refs.opt('systems', row.systemId),
    title: row.title,
    color: oneOf(color, row.color),
    isDefault: row.isDefault,
    createdAt: ms(row.createdAt),
  };
}

export function systemStatusDefinition(
  row: Row<typeof pg.systemStatusDefinitions>,
): Insert<'systemStatusDefinitions'> {
  return {
    pgId: row.id,
    systemType: oneOf(templateType, row.systemType),
    statusName: row.statusName,
    label: row.label,
    position: row.position,
    emoji: opt(row.emoji),
  };
}

export function taskReminder(row: Row<typeof pg.taskReminders>, refs: Refs): Insert<'taskReminders'> {
  return {
    pgId: row.id,
    taskId: refs.id('tasks', row.taskId),
    userId: refs.id('users', row.userId),
    remindAt: ms(row.remindAt),
    sentAt: optMs(row.sentAt),
    label: opt(row.label),
    source: oneOf(reminderSource, row.source),
    createdAt: ms(row.createdAt),
  };
}

// ── Contenido ───────────────────────────────────────────────────────────────

/** `path` (ltree) no viaja: el árbol se arma en memoria desde parentId. */
export function folder(row: Row<typeof pg.folders>, refs: Refs): Insert<'folders'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    systemId: refs.opt('systems', row.systemId),
    parentId: refs.self('folders', row.parentId),
    name: row.name,
    color: oneOf(color, row.color),
    sortIndex: row.sortIndex,
    metadata: jsonObject(row.metadata),
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function page(row: Row<typeof pg.pages>, refs: Refs): Insert<'pages'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    folderId: refs.opt('folders', row.folderId),
    systemId: refs.opt('systems', row.systemId),
    parentPageId: refs.self('pages', row.parentPageId),
    title: opt(row.title),
    content: opt(row.content),
    isPinned: row.isPinned,
    completedAt: optMs(row.completedAt),
    deletedAt: optMs(row.deletedAt),
    clientRequestId: opt(row.clientRequestId),
    lemas: lematizar(row.title, row.content),
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function stickyNote(row: Row<typeof pg.stickyNotes>, refs: Refs): Insert<'stickyNotes'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    pageId: refs.opt('pages', row.pageId),
    folderId: refs.opt('folders', row.folderId),
    title: opt(row.title),
    content: opt(row.content),
    color: oneOf(color, row.color),
    sortIndex: row.sortIndex,
    positionSide: opt(row.positionSide),
    positionY: opt(row.positionY),
    positionX: opt(row.positionX),
    anchorId: opt(row.anchorId),
    stackId: opt(row.stackId),
    isEureka: row.isEureka,
    textAnchor: opt(row.textAnchor),
    clientRequestId: opt(row.clientRequestId),
    lemas: lematizar(row.title, row.content, row.textAnchor),
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function pageSnapshot(row: Row<typeof pg.pageSnapshots>, refs: Refs): Insert<'pageSnapshots'> {
  return {
    pgId: row.id,
    pageId: refs.id('pages', row.pageId),
    userId: refs.id('users', row.userId),
    content: opt(row.content),
    wordCount: row.wordCount,
    sessionStartedAt: optMs(row.sessionStartedAt),
    createdAt: ms(row.createdAt),
  };
}

export function entity(row: Row<typeof pg.entities>, refs: Refs): Insert<'entities'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    systemId: refs.id('systems', row.systemId),
    type: oneOf(entityType, row.type),
    name: row.name,
    aliases: row.aliases,
    summary: opt(row.summary),
    attributes: jsonObject(row.attributes),
    coverImageUrl: opt(row.coverImageUrl),
    images: row.images,
    threadResolvedMentions: opt(row.threadResolvedMentions),
    deletedAt: optMs(row.deletedAt),
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function entityRelation(
  row: Row<typeof pg.entityRelations>,
  refs: Refs,
): Insert<'entityRelations'> {
  return {
    pgId: row.id,
    fromEntityId: refs.id('entities', row.fromEntityId),
    toEntityId: refs.id('entities', row.toEntityId),
    label: opt(row.label),
    notes: opt(row.notes),
    createdAt: ms(row.createdAt),
  };
}

export function taskPageLink(row: Row<typeof pg.taskPageLinks>, refs: Refs): Insert<'taskPageLinks'> {
  return { taskId: refs.id('tasks', row.taskId), pageId: refs.id('pages', row.pageId) };
}

export function pageTag(row: Row<typeof pg.pageTags>, refs: Refs): Insert<'pageTags'> {
  return { pageId: refs.id('pages', row.pageId), tagId: refs.id('contextTags', row.tagId) };
}

export function pageEntityMention(
  row: Row<typeof pg.pageEntityMentions>,
  refs: Refs,
): Insert<'pageEntityMentions'> {
  return {
    pageId: refs.id('pages', row.pageId),
    entityId: refs.id('entities', row.entityId),
    mentionCount: row.mentionCount,
  };
}

// ── Energía y medida ────────────────────────────────────────────────────────

export function energyCheckin(row: Row<typeof pg.energyCheckins>, refs: Refs): Insert<'energyCheckins'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    date: row.date,
    slot: oneOf(checkinSlot, row.slot),
    currentLevel: row.currentLevel,
    sleepQuality: oneOf(sleepQuality, row.sleepQuality),
    predictionAccuracy: optOneOf(predictionAccuracy, row.predictionAccuracy),
    alphaBefore: opt(row.alphaBefore),
    alphaAfter: opt(row.alphaAfter),
    createdAt: ms(row.createdAt),
  };
}

export function energyPrediction(
  row: Row<typeof pg.energyPredictions>,
  refs: Refs,
): Insert<'energyPredictions'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    date: row.date,
    slot: oneOf(checkinSlot, row.slot),
    predictedLevel: row.predictedLevel,
    alphaAtPrediction: row.alphaAtPrediction,
    createdAt: ms(row.createdAt),
  };
}

export function behaviorSnapshot(
  row: Row<typeof pg.behaviorSnapshots>,
  refs: Refs,
): Insert<'behaviorSnapshots'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    date: row.date,
    tasksCreated: row.tasksCreated,
    tasksCompleted: row.tasksCompleted,
    tasksOverdue: row.tasksOverdue,
    criticalCount: row.criticalCount,
    activeCount: row.activeCount,
    completionRate: row.completionRate,
    learningAlpha: row.learningAlpha,
    updatedAt: ms(row.updatedAt),
  };
}

export function timeLog(row: Row<typeof pg.timeLogs>, refs: Refs): Insert<'timeLogs'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    taskId: refs.opt('tasks', row.taskId),
    pageId: refs.opt('pages', row.pageId),
    systemId: refs.id('systems', row.systemId),
    startedAt: ms(row.startedAt),
    endedAt: optMs(row.endedAt),
    durationMinutes: row.durationMinutes,
    wordsWritten: opt(row.wordsWritten),
    source: oneOf(timeSource, row.source),
    createdAt: ms(row.createdAt),
  };
}

// ── Integraciones y operación ───────────────────────────────────────────────

export function syncConnection(
  row: Row<typeof pg.syncConnections>,
  refs: Refs,
): Insert<'syncConnections'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    provider: oneOf(syncProvider, row.provider),
    accessTokenEncrypted: row.accessTokenEncrypted,
    refreshTokenEncrypted: opt(row.refreshTokenEncrypted),
    feedUrl: opt(row.feedUrl),
    lastSyncedAt: optMs(row.lastSyncedAt),
    createdAt: ms(row.createdAt),
    updatedAt: ms(row.updatedAt),
  };
}

export function pushSubscription(
  row: Row<typeof pg.pushSubscriptions>,
  refs: Refs,
): Insert<'pushSubscriptions'> {
  return {
    pgId: row.id,
    userId: refs.id('users', row.userId),
    endpoint: row.endpoint,
    authKey: row.authKey,
    p256dhKey: row.p256dhKey,
    createdAt: ms(row.createdAt),
  };
}

export function cronRun(row: Row<typeof pg.cronRuns>): Insert<'cronRuns'> {
  return {
    pgId: row.id,
    job: row.job,
    startedAt: ms(row.startedAt),
    finishedAt: optMs(row.finishedAt),
    ok: row.ok,
    error: opt(row.error),
    result: row.result ?? undefined,
  };
}

export function rateLimit(row: Row<typeof pg.rateLimits>): Insert<'rateLimits'> {
  return {
    identity: row.identity,
    bucket: row.bucket,
    windowStart: ms(row.windowStart),
    hits: row.hits,
  };
}
