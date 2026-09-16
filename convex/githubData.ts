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
import { GITHUB_SOURCE, type GithubIssue, type GithubRepoRef, type GithubSystemLink } from '../src/features/github-sync/github-sync.types';
import { forbidden, notFound } from './lib/errors';
import { kinoZodMutation } from './lib/fn';
import { lematizar } from './lib/lemas';
import { moveTaskBoardDoc } from './tasks';

// La parte de la sincronización con GitHub que escribe en la base. Lo que
// habla con GitHub y cifra el token vive en `github.ts`, en Node.

type SystemLike = Pick<Doc<'systems'>, 'templateType' | 'metadata'>;

/** El bloque `metadata.github` de un sistema de tipo proyecto, tal y como está guardado. */
function githubMetaOf(system: SystemLike): Partial<GithubSystemLink> | undefined {
  if (system.templateType !== 'project') return undefined;
  return (system.metadata as { github?: Partial<GithubSystemLink> } | undefined)?.github;
}

export function repoRefOf(system: SystemLike): GithubRepoRef | null {
  const ref = githubMetaOf(system);
  if (!ref?.owner || !ref?.repo) return null;
  return { owner: ref.owner, repo: ref.repo };
}

/**
 * Hasta dónde llegó el último refresco de **este** sistema, o null si nunca se
 * sincronizó. Es el cursor que viaja a GitHub como `since`, y es del sistema
 * porque cada uno mira su propio repositorio.
 */
export function syncedThroughOf(system: SystemLike): number | null {
  const cursor = githubMetaOf(system)?.syncedThrough;
  return typeof cursor === 'number' ? cursor : null;
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
    return row
      ? { accessTokenEncrypted: row.accessTokenEncrypted, lastSyncedAt: row.lastSyncedAt ?? null }
      : null;
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
    return { id: system._id, metadata: system.metadata ?? null, repo: repoRefOf(system), syncedThrough: syncedThroughOf(system) };
  },
});

/**
 * Enlaza el repositorio. El bloque se escribe entero y sin cursor a propósito:
 * enlazar otro repositorio es empezar de cero, y heredar hasta dónde llegó el
 * anterior dejaría fuera todos los issues viejos del nuevo.
 */
export const linkRepoMeta = internalMutation({
  args: { userId: v.id('users'), systemId: v.id('systems'), owner: v.string(), repo: v.string() },
  handler: async (ctx, { userId, systemId, owner, repo }) => {
    const system = await requireProjectSystem(ctx, userId, systemId);
    await ctx.db.patch(systemId, { metadata: { ...(system.metadata ?? {}), github: { owner, repo } }, updatedAt: Date.now() });
    return null;
  },
});

/**
 * Cuál de dos tarjetas del mismo issue manda en el refresco: la viva sobre la
 * de la papelera, y entre dos vivas la más antigua, que es la que lleva encima
 * lo que Kino añadió.
 */
function gemelaQueManda(a: Doc<'tasks'>, b: Doc<'tasks'>): Doc<'tasks'> {
  const aViva = a.deletedAt === undefined;
  const bViva = b.deletedAt === undefined;
  if (aViva !== bViva) return aViva ? a : b;
  return a._creationTime <= b._creationTime ? a : b;
}

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
  args: { userId: v.id('users'), systemId: v.id('systems'), issues: v.array(issueValidator), truncated: v.boolean(), syncedThrough: v.optional(v.number()) },
  handler: async (ctx, { userId, systemId, issues, truncated, syncedThrough }) => {
    const system = await requireProjectSystem(ctx, userId, systemId);
    const now = Date.now();
    const typed = issues as GithubIssue[];

    // Un sprint por milestone; reimportar actualiza el nombre, nunca el estado.
    // El orden sale del id del milestone, que crece con su creación, y no del
    // orden en que los issues los mencionan: así dos refrescos de la misma
    // respuesta en distinto sentido dejan los sprints en la misma fila.
    const sprintIdByMilestone = new Map<number, Id<'sprints'>>();
    let sprintsCreated = 0;
    const sprints = await ctx.db.query('sprints').withIndex('by_system_status', (q) => q.eq('systemId', systemId)).collect();
    const milestones = new Map(typed.flatMap((issue) => (issue.milestone ? [[issue.milestone.id, issue.milestone] as const] : [])));
    for (const milestone of [...milestones.values()].sort((a, b) => a.id - b.id)) {
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

    // El rango es todas las tareas de este sistema, vivas y en la papelera. Las
    // borradas entran a propósito: sin ellas el issue no encuentra su tarjeta y
    // el refresco la vuelve a importar, así que borrar una tarjeta no servía de
    // nada mientras el issue siguiera existiendo.
    const tasks = (await ctx.db.query('tasks').withIndex('by_system_alive_status', (q) => q.eq('systemId', systemId)).collect()).filter(
      (t) => t.userId === userId,
    );
    // Dos tarjetas del mismo issue existen de verdad: las dejó el defecto viejo
    // de reimportar lo borrado. Cuál manda no puede salir del orden en que el
    // índice devuelve los documentos, que pone las vivas primero porque
    // `deletedAt: undefined` ordena antes que cualquier número: así la borrada
    // pisaba a su gemela viva y la tarjeta del tablero dejaba de moverse.
    const existingByExternal = new Map<string, Doc<'tasks'>>();
    for (const task of tasks) {
      if (task.externalSource !== GITHUB_SOURCE || !task.externalId) continue;
      const previa = existingByExternal.get(task.externalId);
      existingByExternal.set(task.externalId, previa ? gemelaQueManda(previa, task) : task);
    }
    const sortBase = Math.max(-1, ...tasks.map((t) => t.sortIndex)) + 1;
    // El sitio de una tarjeta nueva sale del número del issue, no del orden en
    // que GitHub la devolvió: la petición pide del más viejo al más nuevo para
    // que el cursor avance, y si el sitio saliera del bucle el tablero nacería
    // al revés. Número alto (issue más nuevo) arriba, que es donde estaba antes
    // de que la petición cambiara de sentido.
    const sitioPorIssue = new Map(
      [...typed]
        .sort((a, b) => b.number - a.number)
        .map((issue, posicion) => [issue.id, sortBase + posicion] as const),
    );

    let imported = 0;
    let updated = 0;
    let unchanged = 0;
    for (const issue of typed) {
      const externalId = externalIdFor(issue);
      const sprintId = issue.milestone ? (sprintIdByMilestone.get(issue.milestone.id) ?? undefined) : undefined;
      const task = existingByExternal.get(externalId);
      // Una tarjeta en la papelera ni se reimporta ni se toca: la persona la
      // quitó del tablero, y el issue sigue existiendo en GitHub. Vuelve
      // restaurándola, y el refresco siguiente la pone al día.
      if (task?.deletedAt !== undefined) {
        unchanged += 1;
        continue;
      }
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
          // La vía se firma, el autor no: el issue lo cerró alguien en GitHub,
          // no una persona en Kino, y el conteo de cierres firmados que propone
          // el techo del día mediría trabajo ajeno si esto escribiera `userId`.
          completedVia: base.status === 'done' ? ('sync' as const) : undefined,
          energyLevel: 'medium',
          priority: 'medium',
          sprintId,
          externalSource: GITHUB_SOURCE,
          externalId,
          sortIndex: sitioPorIssue.get(issue.id) ?? sortBase,
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
      const patch = taskPatchFromIssue(
        issue,
        {
          title: task.title,
          description: task.description ?? null,
          boardStatus: task.boardStatus ?? null,
          sprintId: task.sprintId ?? null,
          completedVia: task.completedVia ?? null,
        },
        sprintId ?? null,
      );
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

    // El cursor se guarda en el sistema, al lado del repositorio que lo produjo:
    // dos sistemas enlazados a dos repositorios llevan cada uno el suyo. Sin
    // repositorio no hay cursor que guardar, y sin valor (una respuesta truncada
    // de la que no se sabe hasta dónde llegó) se queda donde estaba.
    const link = repoRefOf(system);
    if (link && syncedThrough !== undefined) {
      await ctx.db.patch(systemId, { metadata: { ...(system.metadata ?? {}), github: { ...link, syncedThrough } }, updatedAt: now });
    }
    // La conexión sólo guarda cuándo se habló con GitHub por última vez, que es
    // de la cuenta y no del repositorio.
    const connection = await connectionRow(ctx, userId);
    if (connection) await ctx.db.patch(connection._id, { lastSyncedAt: now, updatedAt: now });
    return { imported, updated, unchanged, sprintsCreated, truncated, syncedAt: new Date(now).toISOString() };
  },
});
