import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import schema from '../../convex/schema';
import type { Id } from '../../convex/_generated/dataModel';
import * as t from './transform';
import { Refs } from './transform';

// Una fila real por tabla, anonimizada, con la forma exacta que Drizzle
// devuelve (Date en timestamptz, texto en date y time, JSON en jsonb). Cada
// documento transformado se inserta en convex-test: si el schema lo rechaza,
// la transformación de esa tabla está mal.

const modules = import.meta.glob('../../convex/**/*.*s');

const at = (iso: string) => new Date(iso);
const USER = '0b9c6d1e-5a4f-4d3c-9b2a-1f0e9d8c7b6a';
const USER2 = '1c8d7e2f-6b5a-4e4d-8c3b-2a1f0e9d8c7b';
const SYSTEM = '2d9e8f3a-7c6b-4f5e-9d4c-3b2a1f0e9d8c';
const TASK = '3e0f9a4b-8d7c-4a6f-8e5d-4c3b2a1f0e9d';
const TASK2 = '4f1a0b5c-9e8d-4b7a-9f6e-5d4c3b2a1f0e';
const FOLDER = '5a2b1c6d-0f9e-4c8b-8a7f-6e5d4c3b2a1f';
const FOLDER2 = '6b3c2d7e-1a0f-4d9c-9b8a-7f6e5d4c3b2a';
const PAGE = '7c4d3e8f-2b1a-4e0d-8c9b-8a7f6e5d4c3b';
const PAGE2 = '8d5e4f9a-3c2b-4f1e-9d0c-9b8a7f6e5d4c';
const TAG = '9e6f5a0b-4d3c-4a2f-8e1d-0c9b8a7f6e5d';
const SPRINT = 'af7a6b1c-5e4d-4b3a-9f2e-1d0c9b8a7f6e';
const ENTITY = 'b08b7c2d-6f5e-4c4b-8a3f-2e1d0c9b8a7f';
const ENTITY2 = 'c19c8d3e-7a6f-4d5c-9b4a-3f2e1d0c9b8a';

/** Una correspondencia de ids ya resuelta, con ids de Convex de mentira. */
function refs(): Refs {
  const r = new Refs();
  r.set('users', [{ pgId: USER, id: 'users:1' }, { pgId: USER2, id: 'users:2' }]);
  r.set('systems', [{ pgId: SYSTEM, id: 'systems:1' }]);
  r.set('tasks', [{ pgId: TASK, id: 'tasks:1' }, { pgId: TASK2, id: 'tasks:2' }]);
  r.set('folders', [{ pgId: FOLDER, id: 'folders:1' }, { pgId: FOLDER2, id: 'folders:2' }]);
  r.set('pages', [{ pgId: PAGE, id: 'pages:1' }, { pgId: PAGE2, id: 'pages:2' }]);
  r.set('contextTags', [{ pgId: TAG, id: 'contextTags:1' }]);
  r.set('sprints', [{ pgId: SPRINT, id: 'sprints:1' }]);
  r.set('entities', [{ pgId: ENTITY, id: 'entities:1' }, { pgId: ENTITY2, id: 'entities:2' }]);
  return r;
}

const userRow: Parameters<typeof t.user>[0] = {
  id: USER,
  email: 'ana@example.com',
  emailVerified: true,
  name: 'Ana',
  image: null,
  provider: 'local',
  providerId: null,
  onboardingCompleted: true,
  status: 'active',
  timezone: 'America/Santo_Domingo',
  createdAt: at('2026-05-18T14:35:41.966Z'),
  updatedAt: at('2026-08-30T02:11:09.100Z'),
};

const taskRow: Parameters<typeof t.task>[0] = {
  id: TASK,
  userId: USER,
  systemId: SYSTEM,
  parentTaskId: TASK2,
  title: 'Escribir el capítulo tres',
  description: 'Revisar las notas de la reunión',
  status: 'today',
  boardStatus: 'in_progress',
  boardStatusChangedAt: at('2026-06-10T14:00:00Z'),
  energyLevel: 'high',
  priority: 'critical',
  taskType: 'task',
  dueDate: '2026-05-20T20:00:00-04:00',
  startDate: null,
  estimatedTime: '01:00:00',
  recurrenceRule: null,
  recurrenceParentId: null,
  folderId: FOLDER,
  contextTagId: TAG,
  sprintId: SPRINT,
  externalSource: null,
  externalId: null,
  clientRequestId: null,
  sortIndex: 3,
  metadata: { eventSubtype: 'quiz' },
  inTodayPlan: true,
  notifiedBeforeDay: false,
  notifiedDueDay: false,
  reminderCount: 0,
  lastRemindedAt: null,
  completedAt: null,
  deletedAt: null,
  createdAt: at('2026-05-18T14:40:00Z'),
  updatedAt: at('2026-05-19T09:00:00Z'),
};

describe('transform', () => {
  it('users: deja atrás lo de Better Auth y convierte las fechas a milisegundos', () => {
    const doc = t.user(userRow);
    expect(doc).toEqual({
      pgId: USER,
      email: 'ana@example.com',
      name: 'Ana',
      image: undefined,
      onboardingCompleted: true,
      status: 'active',
      timezone: 'America/Santo_Domingo',
      createdAt: Date.parse('2026-05-18T14:35:41.966Z'),
      updatedAt: Date.parse('2026-08-30T02:11:09.100Z'),
    });
    expect(doc).not.toHaveProperty('provider');
    expect(doc).not.toHaveProperty('emailVerified');
  });

  it('tasks: resuelve referencias, recorta la hora, lee la fecha con zona y lematiza', () => {
    const doc = t.task(taskRow, refs());
    expect(doc.userId).toBe('users:1');
    expect(doc.parentTaskId).toBe('tasks:2');
    expect(doc.folderId).toBe('folders:1');
    expect(doc.contextTagId).toBe('contextTags:1');
    expect(doc.sprintId).toBe('sprints:1');
    expect(doc.estimatedTime).toBe('01:00');
    expect(doc.dueDate).toBe(Date.parse('2026-05-21T00:00:00Z'));
    expect(doc.startDate).toBeUndefined();
    expect(doc.metadata).toEqual({ eventSubtype: 'quiz' });
    expect(doc.lemas).toBe('escrib el capitul tres revis las not de la reunion');
  });

  it('tasks: la referencia a la propia tabla queda vacía en la primera pasada', () => {
    const firstPass = new Refs();
    firstPass.set('users', [{ pgId: USER, id: 'users:1' }]);
    firstPass.set('systems', [{ pgId: SYSTEM, id: 'systems:1' }]);
    const doc = t.task(
      { ...taskRow, folderId: null, contextTagId: null, sprintId: null },
      firstPass,
    );
    expect(doc.parentTaskId).toBeUndefined();
  });

  it('una referencia obligatoria sin destino es un error, no un documento roto', () => {
    expect(() => t.task(taskRow, new Refs())).toThrow(/users: no hay documento/);
  });

  it('un valor fuera del enum de Convex no pasa', () => {
    const status = 'suspended' as unknown as typeof userRow.status;
    expect(() => t.user({ ...userRow, status })).toThrow(/fuera del enum/);
  });

  it('userEnergyProfile: el JSON en texto sale como listas de verdad', () => {
    const doc = t.userEnergyProfile(
      {
        userId: USER,
        chronotype: 'evening',
        sleepTypicalHours: 7,
        availableHoursPerDay: 8,
        energyFloor: 20,
        rechargePresets: '[{"label":"Meditar","delta":15}]',
        learnedCurve: '[10,6.7,11.1]',
        learningAlpha: 0.4,
        createdAt: at('2026-05-18T14:40:00Z'),
        updatedAt: at('2026-05-18T14:40:00Z'),
      },
      refs(),
    );
    expect(doc.rechargePresets).toEqual([{ label: 'Meditar', delta: 15 }]);
    expect(doc.learnedCurve).toEqual([10, 6.7, 11.1]);
  });

  it('folders: el path ltree no viaja', () => {
    const doc = t.folder(
      {
        id: FOLDER,
        userId: USER,
        systemId: SYSTEM,
        parentId: FOLDER2,
        name: 'Semestre 2',
        color: 'purple',
        path: '5a2b1c6d_0f9e_4c8b_8a7f_6e5d4c3b2a1f',
        sortIndex: 0,
        metadata: { professor: 'X' },
        createdAt: at('2026-05-18T14:40:00Z'),
        updatedAt: at('2026-05-18T14:40:00Z'),
      },
      refs(),
    );
    expect(doc).not.toHaveProperty('path');
    expect(doc.parentId).toBe('folders:2');
  });

  it('cada tabla produce un documento que el schema de Convex acepta', async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const r = new Refs();
      const link = async <T extends Parameters<Refs['set']>[0]>(
        table: T,
        pgId: string,
        doc: Parameters<typeof ctx.db.insert<T>>[1],
      ) => {
        const id = await ctx.db.insert(table, doc);
        r.add(table, pgId, id);
        return id as Id<T>;
      };
      const now = at('2026-05-18T14:40:00Z');
      await link('users', USER, t.user(userRow));
      await link('users', USER2, t.user({ ...userRow, id: USER2, email: 'bo@example.com' }));
      await ctx.db.insert(
        'userSettings',
        t.userSettings(
          {
            userId: USER,
            profileType: 'student',
            archetypeIdentity: null,
            onboardingVersion: 2,
            weeklyReviewDay: 'sun',
            dailyResetTime: '00:00:00',
            todayPlanDate: '2026-08-27',
            dailyEnergyLimit: 50,
            focusTimeoutHours: 3,
            theme: 'dark',
            notificationsEnabled: true,
            createdAt: now,
            updatedAt: now,
          },
          r,
        ),
      );
      await link(
        'systems',
        SYSTEM,
        t.system(
          {
            id: SYSTEM,
            userId: USER,
            name: 'Universidad',
            color: 'blue',
            identityStatement: null,
            templateType: 'academic',
            energyIdeal: 'high',
            icon: 'graduation-cap',
            isActive: true,
            isInbox: false,
            expectedFrequency: null,
            triggerContext: null,
            metadata: { tabs: ['action', 'backlog'], defaultTab: 'action' },
            sortOrder: 1,
            createdAt: now,
            updatedAt: now,
          },
          r,
        ),
      );
      await link(
        'contextTags',
        TAG,
        t.contextTag(
          { id: TAG, userId: USER, systemId: null, title: 'casa', color: 'green', isDefault: false, createdAt: now },
          r,
        ),
      );
      await ctx.db.insert(
        'systemStatusDefinitions',
        t.systemStatusDefinition({
          id: 'd2a0e9f4-8b7a-4e6d-8c5b-4a3f2e1d0c9b',
          systemType: 'project',
          statusName: 'todo',
          label: 'Por hacer',
          position: 0,
          emoji: null,
        }),
      );
      await link(
        'sprints',
        SPRINT,
        t.sprint(
          {
            id: SPRINT,
            userId: USER,
            systemId: SYSTEM,
            name: 'Sprint 1',
            goal: null,
            startDate: now,
            endDate: null,
            status: 'active',
            completedAt: null,
            sortOrder: 0,
            externalId: '12',
            createdAt: now,
            updatedAt: now,
          },
          r,
        ),
      );
      const folderRow = {
        id: FOLDER,
        userId: USER,
        systemId: SYSTEM,
        parentId: null,
        name: 'Notas',
        color: 'blue',
        path: 'x',
        sortIndex: 0,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      } satisfies Parameters<typeof t.folder>[0];
      await link('folders', FOLDER, t.folder(folderRow, r));
      await link('folders', FOLDER2, t.folder({ ...folderRow, id: FOLDER2, parentId: FOLDER }, r));
      await link('tasks', TASK2, t.task({ ...taskRow, id: TASK2, parentTaskId: null }, r));
      await link('tasks', TASK, t.task(taskRow, r));
      const pageRow = {
        id: PAGE,
        userId: USER,
        folderId: FOLDER,
        systemId: SYSTEM,
        parentPageId: null,
        title: 'Capítulo 1',
        content: '<p>Había una vez</p>',
        isPinned: false,
        completedAt: null,
        deletedAt: null,
        clientRequestId: null,
        createdAt: now,
        updatedAt: now,
      } satisfies Parameters<typeof t.page>[0];
      await link('pages', PAGE, t.page(pageRow, r));
      await link('pages', PAGE2, t.page({ ...pageRow, id: PAGE2, parentPageId: PAGE }, r));
      await ctx.db.insert(
        'stickyNotes',
        t.stickyNote(
          {
            id: 'e3b1f0a5-9c8b-4f7e-9d6c-5b4a3f2e1d0c',
            userId: USER,
            pageId: PAGE,
            folderId: null,
            title: null,
            content: 'Revisar esto',
            color: 'yellow',
            sortIndex: 0,
            positionSide: 'over',
            positionY: 0.79,
            positionX: -0.21,
            anchorId: null,
            stackId: null,
            isEureka: false,
            textAnchor: 'una vez',
            clientRequestId: null,
            createdAt: now,
            updatedAt: now,
          },
          r,
        ),
      );
      await ctx.db.insert(
        'pageSnapshots',
        t.pageSnapshot(
          {
            id: 'f4c2a1b6-0d9c-4a8f-8e7d-6c5b4a3f2e1d',
            pageId: PAGE,
            userId: USER,
            content: '<p>Había</p>',
            wordCount: 1,
            sessionStartedAt: now,
            createdAt: now,
          },
          r,
        ),
      );
      const entityRow = {
        id: ENTITY,
        userId: USER,
        systemId: SYSTEM,
        type: 'character',
        name: 'Luffy',
        aliases: ['Sombrero de Paja'],
        summary: null,
        attributes: { age: 19 },
        coverImageUrl: null,
        images: [],
        threadResolvedMentions: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      } satisfies Parameters<typeof t.entity>[0];
      await link('entities', ENTITY, t.entity(entityRow, r));
      await link('entities', ENTITY2, t.entity({ ...entityRow, id: ENTITY2, name: 'Zoro' }, r));
      await ctx.db.insert(
        'entityRelations',
        t.entityRelation(
          {
            id: 'a5d3b2c7-1e0d-4b9a-9f8e-7d6c5b4a3f2e',
            fromEntityId: ENTITY,
            toEntityId: ENTITY2,
            label: 'capitán de',
            notes: null,
            createdAt: now,
          },
          r,
        ),
      );
      await ctx.db.insert('taskPageLinks', t.taskPageLink({ taskId: TASK, pageId: PAGE }, r));
      await ctx.db.insert('pageTags', t.pageTag({ pageId: PAGE, tagId: TAG }, r));
      await ctx.db.insert(
        'pageEntityMentions',
        t.pageEntityMention({ pageId: PAGE, entityId: ENTITY, mentionCount: 2 }, r),
      );
      await ctx.db.insert(
        'taskReminders',
        t.taskReminder(
          {
            id: 'b6e4c3d8-2f1e-4c0b-8a9f-8e7d6c5b4a3f',
            taskId: TASK,
            userId: USER,
            remindAt: now,
            sentAt: null,
            label: null,
            source: 'auto',
            createdAt: now,
          },
          r,
        ),
      );
      await ctx.db.insert(
        'timeLogs',
        t.timeLog(
          {
            id: 'c7f5d4e9-3a2f-4d1c-9b0a-9f8e7d6c5b4a',
            userId: USER,
            taskId: TASK,
            pageId: null,
            systemId: SYSTEM,
            startedAt: now,
            endedAt: now,
            durationMinutes: 25,
            wordsWritten: null,
            source: 'pomodoro',
            createdAt: now,
          },
          r,
        ),
      );
      await ctx.db.insert(
        'syncConnections',
        t.syncConnection(
          {
            id: 'd8a6e5f0-4b3a-4e2d-8c1b-0a9f8e7d6c5b',
            userId: USER,
            provider: 'github',
            accessTokenEncrypted: 'enc',
            refreshTokenEncrypted: null,
            feedUrl: null,
            lastSyncedAt: null,
            createdAt: now,
            updatedAt: now,
          },
          r,
        ),
      );
      await ctx.db.insert(
        'pushSubscriptions',
        t.pushSubscription(
          {
            id: 'e9b7f6a1-5c4b-4f3e-9d2c-1b0a9f8e7d6c',
            userId: USER,
            endpoint: 'https://push.example/x',
            authKey: 'a',
            p256dhKey: 'p',
            createdAt: now,
          },
          r,
        ),
      );
      await ctx.db.insert(
        'energyCheckins',
        t.energyCheckin(
          {
            id: 'f0c8a7b2-6d5c-4a4f-8e3d-2c1b0a9f8e7d',
            userId: USER,
            date: '2026-09-03',
            slot: 'morning',
            currentLevel: 70,
            sleepQuality: 'good',
            predictionAccuracy: 'accurate',
            alphaBefore: 0.1,
            alphaAfter: 0.2,
            createdAt: now,
          },
          r,
        ),
      );
      await ctx.db.insert(
        'energyPredictions',
        t.energyPrediction(
          {
            id: 'a1d9b8c3-7e6d-4b5a-9f4e-3d2c1b0a9f8e',
            userId: USER,
            date: '2026-09-03',
            slot: 'morning',
            predictedLevel: 65,
            alphaAtPrediction: 0.1,
            createdAt: now,
          },
          r,
        ),
      );
      await ctx.db.insert(
        'behaviorSnapshots',
        t.behaviorSnapshot(
          {
            id: 'b2e0c9d4-8f7e-4c6b-8a5f-4e3d2c1b0a9f',
            userId: USER,
            date: '2026-09-02',
            tasksCreated: 3,
            tasksCompleted: 2,
            tasksOverdue: 0,
            criticalCount: 1,
            activeCount: 4,
            completionRate: 0.66,
            learningAlpha: 0.2,
            updatedAt: now,
          },
          r,
        ),
      );
      await ctx.db.insert(
        'cronRuns',
        t.cronRun({
          id: 'c3f1d0e5-9a8f-4d7c-9b6a-5f4e3d2c1b0a',
          job: 'daily-snapshot',
          startedAt: now,
          finishedAt: now,
          ok: true,
          error: null,
          result: { snapshots: 2 },
        }),
      );
      await ctx.db.insert(
        'rateLimits',
        t.rateLimit({ identity: 'sess:abc', bucket: 'mutation', windowStart: now, hits: 4 }),
      );
    });
  });
});
