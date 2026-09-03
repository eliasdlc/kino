import { convexTest } from 'convex-test';
import type { WithoutSystemFields } from 'convex/server';
import { describe, expect, it } from 'vitest';
import type { Doc, TableNames } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import schema from './schema';

const modules = import.meta.glob('./**/*.*s');

const TABLE_NAMES = Object.keys(schema.tables) as TableNames[];

/** Las tablas que el importador trae de Postgres y por eso llevan pgId. */
const FROM_POSTGRES: TableNames[] = [
  'users',
  'systems',
  'tasks',
  'sprints',
  'contextTags',
  'systemStatusDefinitions',
  'taskReminders',
  'folders',
  'pages',
  'stickyNotes',
  'pageSnapshots',
  'entities',
  'entityRelations',
  'energyCheckins',
  'energyPredictions',
  'behaviorSnapshots',
  'timeLogs',
  'syncConnections',
  'pushSubscriptions',
  'cronRuns',
];

const NOW = 1_756_857_600_000;

type Insert<T extends TableNames> = WithoutSystemFields<Doc<T>>;

const minimalTask = (
  userId: Doc<'tasks'>['userId'],
  systemId: Doc<'tasks'>['systemId'],
): Insert<'tasks'> => ({
  userId,
  systemId,
  title: 'Escribir el schema',
  status: 'backlog',
  energyLevel: 'medium',
  priority: 'medium',
  sortIndex: 0,
  inTodayPlan: false,
  notifiedBeforeDay: false,
  notifiedDueDay: false,
  reminderCount: 0,
  createdAt: NOW,
  updatedAt: NOW,
});

/**
 * Inserta el documento mínimo de cada tabla, en el orden de sus referencias.
 * Un campo obligatorio que falte aquí es un error de tipo, y uno que sobre en
 * el schema (o que falte en él) también: la tabla de abajo es exhaustiva.
 */
async function seedOnePerTable(ctx: MutationCtx) {
  const userId = await ctx.db.insert('users', {
    email: 'elias@usekino.dev',
    name: 'Elias',
    onboardingCompleted: true,
    status: 'active',
    timezone: 'America/Santo_Domingo',
    createdAt: NOW,
    updatedAt: NOW,
  });
  await ctx.db.insert('userSettings', {
    userId,
    onboardingVersion: 1,
    weeklyReviewDay: 'sun',
    dailyResetTime: '00:00',
    dailyEnergyLimit: 50,
    focusTimeoutHours: 3,
    theme: 'system',
    notificationsEnabled: true,
    createdAt: NOW,
    updatedAt: NOW,
  });
  await ctx.db.insert('userBilling', { userId, tier: 'free', createdAt: NOW, updatedAt: NOW });
  await ctx.db.insert('usageCounters', {
    userId,
    periodMonth: '2026-09',
    metric: 'mcp_calls',
    amount: 1,
  });

  const systemId = await ctx.db.insert('systems', {
    userId,
    name: 'Inbox',
    color: 'blue',
    templateType: 'inbox',
    icon: 'inbox',
    isActive: true,
    isInbox: true,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  });
  const taskId = await ctx.db.insert('tasks', minimalTask(userId, systemId));
  await ctx.db.insert('sprints', {
    userId,
    systemId,
    name: 'Sprint 1',
    status: 'active',
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  });
  const tagId = await ctx.db.insert('contextTags', {
    userId,
    title: 'casa',
    color: 'green',
    isDefault: false,
    createdAt: NOW,
  });
  await ctx.db.insert('systemStatusDefinitions', {
    systemType: 'project',
    statusName: 'todo',
    label: 'Por hacer',
    position: 0,
  });
  await ctx.db.insert('taskReminders', {
    taskId,
    userId,
    remindAt: NOW,
    source: 'user',
    createdAt: NOW,
  });

  const folderId = await ctx.db.insert('folders', {
    userId,
    name: 'Notas',
    color: 'blue',
    sortIndex: 0,
    createdAt: NOW,
    updatedAt: NOW,
  });
  const pageId = await ctx.db.insert('pages', {
    userId,
    isPinned: false,
    createdAt: NOW,
    updatedAt: NOW,
  });
  await ctx.db.insert('stickyNotes', {
    userId,
    folderId,
    color: 'yellow',
    sortIndex: 0,
    isEureka: false,
    createdAt: NOW,
    updatedAt: NOW,
  });
  const snapshotId = await ctx.db.insert('pageSnapshots', {
    pageId,
    userId,
    wordCount: 0,
    createdAt: NOW,
  });
  const entityId = await ctx.db.insert('entities', {
    userId,
    systemId,
    type: 'character',
    name: 'Luffy',
    aliases: [],
    images: [],
    createdAt: NOW,
    updatedAt: NOW,
  });
  await ctx.db.insert('entityRelations', {
    fromEntityId: entityId,
    toEntityId: entityId,
    createdAt: NOW,
  });
  await ctx.db.insert('taskPageLinks', { taskId, pageId });
  await ctx.db.insert('pageTags', { pageId, tagId });
  await ctx.db.insert('pageEntityMentions', { pageId, entityId, mentionCount: 1 });

  await ctx.db.insert('userEnergyProfile', {
    userId,
    chronotype: 'intermediate',
    sleepTypicalHours: 7,
    availableHoursPerDay: 8,
    energyFloor: 20,
    rechargePresets: [],
    learnedCurve: [],
    learningAlpha: 0,
    createdAt: NOW,
    updatedAt: NOW,
  });
  await ctx.db.insert('energyCheckins', {
    userId,
    date: '2026-09-03',
    slot: 'morning',
    currentLevel: 70,
    sleepQuality: 'good',
    createdAt: NOW,
  });
  await ctx.db.insert('energyPredictions', {
    userId,
    date: '2026-09-03',
    slot: 'morning',
    predictedLevel: 65,
    alphaAtPrediction: 0,
    createdAt: NOW,
  });
  await ctx.db.insert('behaviorSnapshots', {
    userId,
    date: '2026-09-03',
    tasksCreated: 0,
    tasksCompleted: 0,
    tasksOverdue: 0,
    criticalCount: 0,
    activeCount: 0,
    completionRate: 0,
    learningAlpha: 0,
    updatedAt: NOW,
  });
  await ctx.db.insert('timeLogs', {
    userId,
    taskId,
    systemId,
    startedAt: NOW,
    durationMinutes: 25,
    source: 'timer',
    createdAt: NOW,
  });

  await ctx.db.insert('syncConnections', {
    userId,
    provider: 'github',
    accessTokenEncrypted: 'enc',
    createdAt: NOW,
    updatedAt: NOW,
  });
  await ctx.db.insert('pushSubscriptions', {
    userId,
    endpoint: 'https://push.example/1',
    authKey: 'a',
    p256dhKey: 'p',
    createdAt: NOW,
  });
  await ctx.db.insert('cronRuns', { job: 'daily-snapshot', startedAt: NOW, ok: false });
  await ctx.db.insert('rateLimits', {
    identity: 'sess:abc',
    bucket: 'mutation',
    windowStart: NOW,
    hits: 1,
  });

  const proposalId = await ctx.db.insert('proposals', {
    userId,
    status: 'pending',
    kind: 'archive',
    evidenceType: 'task',
    evidenceId: taskId,
    payload: {},
    expiresAt: NOW,
    createdAt: NOW,
  });
  await ctx.db.insert('eventLog', {
    userId,
    actorChannel: 'session',
    action: 'tasks.create',
    targetType: 'task',
    targetId: taskId,
    payload: {},
    occurredAt: NOW,
    proposalId,
    snapshotId,
  });
  await ctx.db.insert('itemLinks', {
    userId,
    fromType: 'task',
    fromId: taskId,
    fromSystemId: systemId,
    toType: 'page',
    toId: pageId,
    toSystemId: systemId,
    reason: 'same-session',
    hits: 1,
    lastSeenAt: NOW,
  });
  await ctx.db.insert('systemMembers', { systemId, userId, role: 'owner', createdAt: NOW });
  await ctx.db.insert('systemInvites', {
    systemId,
    email: 'bob@example.com',
    tokenHash: 'deadbeef',
    role: 'member',
    expiresAt: NOW,
    createdAt: NOW,
  });
  await ctx.db.insert('sessionDigests', {
    userId,
    source: 'claude-code',
    externalId: 'sess-1',
    digest: {},
    createdAt: NOW,
  });
  await ctx.db.insert('captures', {
    userId,
    status: 'pending',
    kind: 'text',
    text: 'llamar al banco',
    expiresAt: NOW,
    createdAt: NOW,
  });
}

describe('convex/schema', () => {
  it('declara las treinta y cinco tablas', () => {
    expect(TABLE_NAMES).toHaveLength(35);
  });

  it('acepta un documento mínimo en cada tabla', async () => {
    const t = convexTest(schema, modules);
    await t.run(seedOnePerTable);
    const counts = await t.run(async (ctx) => {
      const entries = await Promise.all(
        TABLE_NAMES.map(async (table) => [table, (await ctx.db.query(table).collect()).length]),
      );
      return Object.fromEntries(entries) as Record<TableNames, number>;
    });
    const empty = TABLE_NAMES.filter((table) => counts[table] !== 1);
    expect(empty).toEqual([]);
  });

  it('rechaza un documento al que le falta un campo obligatorio', async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.run(async (ctx) => {
        const userId = await ctx.db.insert('users', {
          email: 'x@usekino.dev',
          name: 'x',
          onboardingCompleted: false,
          status: 'active',
          timezone: 'UTC',
          createdAt: NOW,
          updatedAt: NOW,
        });
        const systemId = await ctx.db.insert('systems', {
          userId,
          name: 'S',
          color: 'blue',
          templateType: 'custom',
          icon: 'folder',
          isActive: true,
          isInbox: false,
          sortOrder: 0,
          createdAt: NOW,
          updatedAt: NOW,
        });
        const { title: _title, ...withoutTitle } = minimalTask(userId, systemId);
        await ctx.db.insert('tasks', withoutTitle as unknown as Insert<'tasks'>);
      }),
    ).rejects.toThrow();
  });

  it('rechaza un valor fuera del enum', async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.run(async (ctx) => {
        await ctx.db.insert('users', {
          email: 'y@usekino.dev',
          name: 'y',
          onboardingCompleted: false,
          status: 'suspended' as unknown as 'active',
          timezone: 'UTC',
          createdAt: NOW,
          updatedAt: NOW,
        });
      }),
    ).rejects.toThrow();
  });

  it('cada tabla que viene de Postgres tiene el índice del importador', () => {
    const withoutPgIndex = FROM_POSTGRES.filter(
      (table) =>
        !schema.tables[table][' indexes']().some((index) => index.indexDescriptor === 'by_pgId'),
    );
    expect(withoutPgIndex).toEqual([]);
  });
});
