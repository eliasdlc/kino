import { v } from 'convex/values';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery } from './_generated/server';
import {
  externalIdFor,
  isEmptyPatch,
  newTaskFromIssue,
  taskPatchFromIssue,
} from '../src/features/github-sync/github-sync.mapper';
import { GITHUB_SOURCE, type GithubIssue, type GithubRepoRef } from '../src/features/github-sync/github-sync.types';
import { forbidden, notFound } from './lib/errors';
import { kinoZodMutation } from './lib/fn';
import { lematizar } from './lib/lemas';
import { moveTaskBoardDoc } from './tasks';

// La parte de la sincronización con GitHub que escribe en la base. Lo que
// habla con GitHub y cifra el token vive en `github.ts`, en Node.

export function repoRefOf(system: Pick<Doc<'systems'>, 'templateType' | 'metadata'>): GithubRepoRef | null {
  if (system.templateType !== 'project') return null;
  const ref = (system.metadata as { github?: Partial<GithubRepoRef> } | undefined)?.github;
  if (!ref?.owner || !ref?.repo) return null;
  return { owner: ref.owner, repo: ref.repo };
}

async function connectionRow(ctx: { db: import('./_generated/server').QueryCtx['db'] }, userId: Id<'users'>) {
  return ctx.db
    .query('syncConnections')
    .withIndex('by_user_provider', (q) => q.eq('userId', userId).eq('provider', GITHUB_SOURCE))
    .unique();
}

export async function requireProjectSystem(ctx: { db: import('./_generated/server').QueryCtx['db'] }, userId: Id<'users'>, id: Id<'systems'>) {
  const system = await ctx.db.get(id);
  if (!system || system.userId !== userId || !system.isActive) notFound('System not found');
  if (system.templateType !== 'project') forbidden('La sincronización con GitHub sólo aplica a sistemas de tipo proyecto.');
  return system;
}

// ── Públicas que no necesitan GitHub ────────────────────────────────────────

export const disconnect = kinoZodMutation({
  args: {},
  handler: async (ctx) => {
    const row = await connectionRow(ctx, ctx.user._id);
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});

export const unlinkRepo = kinoZodMutation({
  args: { id: zid('systems') },
  handler: async (ctx, { id }) => {
    const system = await requireProjectSystem(ctx, ctx.user._id, id);
    const metadata = { ...(system.metadata ?? {}) };
    delete metadata.github;
    await ctx.db.patch(id, { metadata, updatedAt: Date.now() });
    return null;
  },
});

// ── Internas, para las acciones ─────────────────────────────────────────────

/** La conexión guardada, con el token todavía cifrado. */
export const connectionOf = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const row = await connectionRow(ctx, userId);
    return row ? { accessTokenEncrypted: row.accessTokenEncrypted, lastSyncedAt: row.lastSyncedAt ?? null } : null;
  },
});

export const saveConnection = internalMutation({
  args: { userId: v.id('users'), accessTokenEncrypted: v.string(), refreshTokenEncrypted: v.optional(v.string()) },
  handler: async (ctx, { userId, accessTokenEncrypted, refreshTokenEncrypted }) => {
    const now = Date.now();
    const row = await connectionRow(ctx, userId);
    if (row) await ctx.db.patch(row._id, { accessTokenEncrypted, refreshTokenEncrypted, updatedAt: now });
    else await ctx.db.insert('syncConnections', { userId, provider: GITHUB_SOURCE, accessTokenEncrypted, refreshTokenEncrypted, createdAt: now, updatedAt: now });
    return null;
  },
});

export const systemForSync = internalQuery({
  args: { userId: v.id('users'), systemId: v.id('systems') },
  handler: async (ctx, { userId, systemId }) => {
    const system = await requireProjectSystem(ctx, userId, systemId);
    return { id: system._id, metadata: system.metadata ?? null, repo: repoRefOf(system) };
  },
});

export const linkRepoMeta = internalMutation({
  args: { userId: v.id('users'), systemId: v.id('systems'), owner: v.string(), repo: v.string() },
  handler: async (ctx, { userId, systemId, owner, repo }) => {
    const system = await requireProjectSystem(ctx, userId, systemId);
    await ctx.db.patch(systemId, { metadata: { ...(system.metadata ?? {}), github: { owner, repo } }, updatedAt: Date.now() });
    return null;
  },
});

const issueValidator = v.object({
  id: v.number(),
  number: v.number(),
  title: v.string(),
  body: v.union(v.string(), v.null()),
  state: v.union(v.literal('open'), v.literal('closed')),
  htmlUrl: v.string(),
  milestone: v.union(
    v.object({ id: v.number(), title: v.string(), description: v.union(v.string(), v.null()), dueOn: v.union(v.string(), v.null()), state: v.union(v.literal('open'), v.literal('closed')) }),
    v.null(),
  ),
});

/**
 * Refleja los issues en el tablero, todo en una transacción. Lo que Kino añade
 * sobre un issue (energía, fecha, plan de hoy) no se toca nunca: el mapper lo
 * declara y esta función no lo escribe.
 */
export const applySync = internalMutation({
  args: { userId: v.id('users'), systemId: v.id('systems'), issues: v.array(issueValidator), truncated: v.boolean() },
  handler: async (ctx, { userId, systemId, issues, truncated }) => {
    await requireProjectSystem(ctx, userId, systemId);
    const now = Date.now();
    const typed = issues as GithubIssue[];

    // Un sprint por milestone; reimportar actualiza el nombre, nunca el estado.
    const sprintIdByMilestone = new Map<number, Id<'sprints'>>();
    let sprintsCreated = 0;
    const sprints = await ctx.db.query('sprints').withIndex('by_system_status', (q) => q.eq('systemId', systemId)).collect();
    for (const issue of typed) {
      const milestone = issue.milestone;
      if (!milestone || sprintIdByMilestone.has(milestone.id)) continue;
      const externalId = String(milestone.id);
      const existing = sprints.find((s) => s.externalId === externalId);
      if (existing) {
        if (existing.name !== milestone.title) await ctx.db.patch(existing._id, { name: milestone.title.slice(0, 255), updatedAt: now });
        sprintIdByMilestone.set(milestone.id, existing._id);
        continue;
      }
      const id = await ctx.db.insert('sprints', {
        userId,
        systemId,
        name: milestone.title.slice(0, 255),
        goal: milestone.description?.slice(0, 500) ?? undefined,
        endDate: milestone.dueOn ? Date.parse(milestone.dueOn) : undefined,
        status: 'active',
        externalId,
        sortOrder: Math.max(-1, ...sprints.map((s) => s.sortOrder)) + 1 + sprintsCreated,
        createdAt: now,
        updatedAt: now,
      });
      sprintIdByMilestone.set(milestone.id, id);
      sprintsCreated += 1;
    }

    const tasks = (await ctx.db.query('tasks').withIndex('by_system_alive_status', (q) => q.eq('systemId', systemId).eq('deletedAt', undefined)).collect()).filter(
      (t) => t.userId === userId,
    );
    const existingByExternal = new Map(tasks.filter((t) => t.externalSource === GITHUB_SOURCE && t.externalId).map((t) => [t.externalId!, t]));
    let sortBase = Math.max(-1, ...tasks.map((t) => t.sortIndex)) + 1;

    let imported = 0;
    let updated = 0;
    let unchanged = 0;
    for (const issue of typed) {
      const externalId = externalIdFor(issue);
      const sprintId = issue.milestone ? (sprintIdByMilestone.get(issue.milestone.id) ?? undefined) : undefined;
      const task = existingByExternal.get(externalId);
      if (!task) {
        const base = newTaskFromIssue(issue);
        await ctx.db.insert('tasks', {
          userId,
          systemId,
          title: base.title,
          description: base.description,
          status: base.status,
          boardStatus: base.boardStatus,
          boardStatusChangedAt: now,
          completedAt: base.status === 'done' ? now : undefined,
          completedBy: base.status === 'done' ? userId : undefined,
          completedVia: base.status === 'done' ? ('sync' as const) : undefined,
          energyLevel: 'medium',
          priority: 'medium',
          sprintId,
          externalSource: GITHUB_SOURCE,
          externalId,
          sortIndex: sortBase++,
          inTodayPlan: false,
          notifiedBeforeDay: false,
          notifiedDueDay: false,
          reminderCount: 0,
          lemas: lematizar(base.title, base.description),
          createdBy: userId,
          createdVia: 'sync',
          createdAt: now,
          updatedAt: now,
        });
        imported += 1;
        continue;
      }
      const patch = taskPatchFromIssue(issue, { title: task.title, description: task.description ?? null, boardStatus: task.boardStatus ?? null, sprintId: task.sprintId ?? null }, sprintId ?? null);
      if (isEmptyPatch(patch)) {
        unchanged += 1;
        continue;
      }
      const changes: Partial<Doc<'tasks'>> = { updatedAt: now };
      if (patch.title !== undefined) changes.title = patch.title;
      if (patch.description !== undefined) changes.description = patch.description;
      if (patch.sprintId !== undefined) changes.sprintId = (patch.sprintId ?? undefined) as Id<'sprints'> | undefined;
      if (patch.title !== undefined || patch.description !== undefined) changes.lemas = lematizar(patch.title ?? task.title, patch.description ?? task.description);
      await ctx.db.patch(task._id, changes);
      // El movimiento de columna pasa por tasks: es quien aplica el puente con el scheduling.
      if (patch.boardStatus) await moveTaskBoardDoc(ctx, userId, 'sync', task._id, patch.boardStatus);
      updated += 1;
    }

    const connection = await connectionRow(ctx, userId);
    if (connection) await ctx.db.patch(connection._id, { lastSyncedAt: now, updatedAt: now });
    return { imported, updated, unchanged, sprintsCreated, truncated, syncedAt: new Date(now).toISOString() };
  },
});
