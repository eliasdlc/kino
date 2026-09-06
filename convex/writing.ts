import { z } from 'zod';
import { zid } from 'convex-helpers/server/zod4';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { EntityAttributes } from '../src/features/entities/entities.attributes';
import {
  CHEKHOV_LIMITS,
  DEFAULT_CHEKHOV,
  detectLooseThreads,
  type ChekhovSettings,
  type ThreadEntity,
} from '../src/features/writing/chekhov';
import {
  insertIndexFor,
  joinScenes,
  listArcs,
  moveScene,
  scenePreview,
  setSceneArc,
  splitScenes,
  type ChapterScenes,
} from '../src/features/writing/plot-grid';
import { withDeltas } from '../src/features/writing/snapshots';
import { buildExcerpts, toPlainText } from '../src/features/writing/story-text';
import { buildSuggestions, type StudioSignals } from '../src/features/writing/studio.js';
import { keyTerms, summarize } from '../src/features/writing/summary';
import { TIMELINE_ORDER_KEY, assignOrders, buildTimeline } from '../src/features/writing/timeline';
import { buildJournal, computeStreak } from '../src/features/writing/writing.streak';
import type { WritingSession } from '../src/features/writing/writing.types';
import { resolveMedium } from '../src/shared/lib/mediums';
import { countWords } from '../src/shared/lib/word-count';
import { findPeakRange } from './lib/energy/curve';
import { forbidden, notFound } from './lib/errors';
import { kinoZodMutation, kinoZodQuery } from './lib/fn';
import { recomputePageMentions } from './lib/mentions';
import { calendarDayInTz, userToday } from './lib/time';
import { captureSnapshot, writingSessionsOf } from './lib/writing/activity';

// El arquetipo de escritura: racha, diario de la obra, manuscrito, hilos
// sueltos, cronología, rejilla de escenas, versiones y el estudio. Todo lo que
// razona vive puro en `src/features/writing/*`; aquí sólo se reúnen los datos.

type Ctx = QueryCtx | MutationCtx;
const DAY_MS = 86_400_000;
const STREAK_LOOKBACK_DAYS = 400;
const iso = (ms: number) => new Date(ms).toISOString();

async function ownFolder(ctx: Ctx, userId: Id<'users'>, id: Id<'folders'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId || doc.deletedAt !== undefined) notFound('Folder not found');
  return doc;
}

async function ownPage(ctx: Ctx, userId: Id<'users'>, id: Id<'pages'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId || doc.deletedAt !== undefined) notFound('Page not found');
  return doc;
}

async function ownSystem(ctx: Ctx, userId: Id<'users'>, id: Id<'systems'>) {
  const doc = await ctx.db.get(id);
  if (!doc || doc.userId !== userId) notFound('System not found');
  return doc;
}

/** Capítulos vivos de una obra, en orden de creación, que es el de lectura. */
async function chaptersOf(ctx: Ctx, userId: Id<'users'>, folderId: Id<'folders'>) {
  const docs = await ctx.db.query('pages').withIndex('by_folder', (q) => q.eq('folderId', folderId)).collect();
  return docs.filter((doc) => doc.userId === userId && doc.deletedAt === undefined).sort((a, b) => a.createdAt - b.createdAt);
}

async function systemPages(ctx: Ctx, userId: Id<'users'>, systemId: Id<'systems'>) {
  const docs = await ctx.db.query('pages').withIndex('by_system', (q) => q.eq('systemId', systemId)).collect();
  return docs.filter((doc) => doc.userId === userId && doc.deletedAt === undefined).sort((a, b) => a.createdAt - b.createdAt);
}

async function universeOf(ctx: Ctx, userId: Id<'users'>, systemId: Id<'systems'>) {
  const docs = await ctx.db
    .query('entities')
    .withIndex('by_system_alive', (q) => q.eq('systemId', systemId).eq('deletedAt', undefined))
    .collect();
  return docs.filter((doc) => doc.userId === userId);
}

async function mentionsOfPages(ctx: Ctx, pageIds: Id<'pages'>[]) {
  const rows = [];
  for (const pageId of pageIds) {
    rows.push(...(await ctx.db.query('pageEntityMentions').withIndex('by_page_entity', (q) => q.eq('pageId', pageId)).collect()));
  }
  return rows;
}

function readWordGoal(metadata: Record<string, unknown> | undefined): number | null {
  const raw = metadata?.wordGoal;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') return Number(raw) || null;
  return null;
}

export function resolveChekhovSettings(raw: unknown): ChekhovSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_CHEKHOV;
  const value = raw as Partial<ChekhovSettings>;
  const clamp = (v: unknown, fallback: number, limits: { min: number; max: number }) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(limits.max, Math.max(limits.min, Math.round(v))) : fallback;
  return {
    maxMentions: clamp(value.maxMentions, DEFAULT_CHEKHOV.maxMentions, CHEKHOV_LIMITS.maxMentions),
    minSilentChapters: clamp(value.minSilentChapters, DEFAULT_CHEKHOV.minSilentChapters, CHEKHOV_LIMITS.minSilentChapters),
  };
}

// ── Panorama y diario ───────────────────────────────────────────────────────

async function overviewOf(ctx: Ctx, user: Doc<'users'>, systemId: Id<'systems'>) {
  const system = await ownSystem(ctx, user._id, systemId);
  const timezone = user.timezone;
  const now = Date.now();
  const today = userToday(timezone, now);
  const since = now - STREAK_LOOKBACK_DAYS * DAY_MS;

  const logs = (await ctx.db.query('timeLogs').withIndex('by_system_started', (q) => q.eq('systemId', systemId).gte('startedAt', since)).collect()).filter(
    (log) => log.userId === user._id && log.pageId !== undefined,
  );
  const days = logs.map((log) => ({ day: calendarDayInTz(log.startedAt, timezone), words: log.wordsWritten ?? 0 }));
  const { streakDays, streakIncludesToday } = computeStreak(days.map((d) => d.day), today);
  const wordsToday = days.filter((d) => d.day === today).reduce((sum, d) => sum + d.words, 0);

  // Última sesión por obra, con todas las sesiones y no sólo las del último año.
  const allLogs = (await ctx.db.query('timeLogs').withIndex('by_system_started', (q) => q.eq('systemId', systemId)).collect()).filter(
    (log) => log.userId === user._id && log.pageId !== undefined,
  );
  const lastByWork = new Map<string, number>();
  for (const log of allLogs) {
    const page = await ctx.db.get(log.pageId!);
    if (!page?.folderId) continue;
    lastByWork.set(page.folderId, Math.max(lastByWork.get(page.folderId) ?? 0, log.startedAt));
  }
  const works = [...lastByWork.entries()].map(([folderId, lastSessionAt]) => ({
    folderId,
    lastSessionAt: iso(lastSessionAt),
    daysSinceLastSession: daysBetween(calendarDayInTz(lastSessionAt, timezone), today),
  }));

  const profile = await ctx.db.query('userEnergyProfile').withIndex('by_user', (q) => q.eq('userId', user._id)).unique();
  const peakWindow = profile && profile.learnedCurve.length === 24 ? findPeakRange(profile.learnedCurve) : null;
  const goal = (system.metadata as { dailyWordGoal?: number } | undefined)?.dailyWordGoal ?? null;

  return {
    streakDays,
    streakIncludesToday,
    wordsToday,
    dailyWordGoal: goal && goal > 0 ? goal : null,
    peakWindow,
    currentHour: Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now)) % 24,
    works,
  };
}

function daysBetween(from: string, to: string): number {
  const parse = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
  };
  return Math.max(0, Math.round((parse(to) - parse(from)) / DAY_MS));
}

export const overview = kinoZodQuery({
  args: { id: zid('systems') },
  handler: async (ctx, { id }) => overviewOf(ctx, ctx.user, id),
});

export const journal = kinoZodQuery({
  args: { id: zid('folders') },
  handler: async (ctx, { id }) => {
    const folder = await ownFolder(ctx, ctx.user._id, id);
    const timezone = ctx.user.timezone;
    const chapters = await chaptersOf(ctx, ctx.user._id, id);

    const sessions: Array<WritingSession & { day: string }> = [];
    for (const chapter of chapters) {
      for (const log of await writingSessionsOf(ctx, ctx.user._id, chapter._id)) {
        sessions.push({
          id: log._id,
          pageId: chapter._id,
          pageTitle: chapter.title ?? null,
          folderId: id,
          startedAt: iso(log.startedAt),
          endedAt: log.endedAt === undefined ? null : iso(log.endedAt),
          durationMinutes: log.durationMinutes,
          wordsWritten: log.wordsWritten ?? 0,
          day: calendarDayInTz(log.startedAt, timezone),
        });
      }
    }
    sessions.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));

    const completions = chapters
      .filter((c) => c.completedAt !== undefined)
      .map((c) => ({ pageId: c._id, pageTitle: c.title ?? null, day: calendarDayInTz(c.completedAt!, timezone) }));

    // Notas eureka de la obra: las de sus capítulos y las ancladas a ella.
    const chapterIds = new Set(chapters.map((c) => c._id));
    const notes = (await ctx.db.query('stickyNotes').withIndex('by_user_alive', (q) => q.eq('userId', ctx.user._id).eq('deletedAt', undefined)).collect()).filter(
      (note) => note.isEureka && (note.folderId === id || (note.pageId !== undefined && chapterIds.has(note.pageId))),
    );
    const breakthroughs = notes
      .map((n) => ({ noteId: n._id, text: [n.title, n.content].filter(Boolean).join(' — ').trim(), day: calendarDayInTz(n.createdAt, timezone) }))
      .filter((n) => n.text.length > 0);

    const totalWords = chapters.reduce((sum, c) => sum + countWords(c.content ?? null), 0);
    const wordGoal = readWordGoal(folder.metadata);
    return {
      folderId: folder._id,
      folderName: folder.name,
      wordGoal,
      totalWords,
      days: buildJournal({ sessions, completions, breakthroughs, totalWords, wordGoal }),
    };
  },
});

// ── Manuscrito y estructura ─────────────────────────────────────────────────

export const manuscript = kinoZodQuery({
  args: { id: zid('folders') },
  handler: async (ctx, { id }) => {
    const folder = await ownFolder(ctx, ctx.user._id, id);
    if (!folder.systemId) notFound('Folder has no system');
    const chapters = (await chaptersOf(ctx, ctx.user._id, id)).map((c) => ({
      id: c._id,
      title: c.title ?? null,
      content: c.content ?? null,
      wordCount: countWords(c.content ?? null),
      completed: c.completedAt !== undefined,
    }));
    return {
      folderId: folder._id,
      systemId: folder.systemId,
      title: folder.name,
      author: ctx.user.name.trim() || null,
      medium: resolveMedium(folder.metadata ?? null),
      totalWords: chapters.reduce((sum, c) => sum + c.wordCount, 0),
      chapters,
    };
  },
});

export const structure = kinoZodQuery({
  args: { id: zid('folders') },
  handler: async (ctx, { id }) => {
    const folder = await ownFolder(ctx, ctx.user._id, id);
    const chapters = await chaptersOf(ctx, ctx.user._id, id);
    const items = [];
    for (const chapter of chapters) {
      const mentions = await ctx.db.query('pageEntityMentions').withIndex('by_page_entity', (q) => q.eq('pageId', chapter._id)).collect();
      const entities = [];
      for (const mention of mentions) {
        const entity = await ctx.db.get(mention.entityId);
        if (entity && entity.deletedAt === undefined) {
          entities.push({ id: entity._id, name: entity.name, type: entity.type, mentionCount: mention.mentionCount });
        }
      }
      items.push({
        id: chapter._id,
        title: chapter.title ?? null,
        wordCount: countWords(chapter.content ?? null),
        completed: chapter.completedAt !== undefined,
        updatedAt: iso(chapter.updatedAt),
        entities: entities.sort((a, b) => b.mentionCount - a.mentionCount),
      });
    }
    return {
      folderId: folder._id,
      name: folder.name,
      medium: resolveMedium(folder.metadata ?? null),
      wordGoal: readWordGoal(folder.metadata),
      totalWords: items.reduce((sum, c) => sum + c.wordCount, 0),
      chapters: items,
    };
  },
});

/** Busca una frase dentro de las obras de un sistema y devuelve fragmentos. */
export const storySearch = kinoZodQuery({
  args: { id: zid('systems'), q: z.string().trim().default('') },
  handler: async (ctx, { id, q }) => {
    if (q.length < 2) return [];
    const needle = q.toLowerCase();
    const pages = (await systemPages(ctx, ctx.user._id, id)).filter((page) => (page.content ?? '').toLowerCase().includes(needle)).slice(0, 50);
    const matches = [];
    for (const page of pages) {
      const excerpts = buildExcerpts(toPlainText(page.content ?? null), q);
      if (excerpts.length === 0) continue;
      const folder = page.folderId ? await ctx.db.get(page.folderId) : null;
      matches.push({ pageId: page._id, pageTitle: page.title ?? null, folderId: page.folderId ?? null, folderName: folder?.name ?? null, excerpts });
    }
    return matches;
  },
});

// ── Hilos sueltos ───────────────────────────────────────────────────────────

async function threadEntitiesOf(ctx: Ctx, userId: Id<'users'>, systemId: Id<'systems'>) {
  const universe = await universeOf(ctx, userId, systemId);
  const pages = await systemPages(ctx, userId, systemId);
  const mentions = await mentionsOfPages(ctx, pages.map((p) => p._id));
  const totals = new Map<string, number>();
  for (const row of mentions) totals.set(row.entityId, (totals.get(row.entityId) ?? 0) + row.mentionCount);
  const entities: ThreadEntity[] = universe.map((e) => ({
    id: e._id,
    name: e.name,
    type: e.type,
    mentionsInSystem: totals.get(e._id) ?? 0,
    threadResolvedMentions: e.threadResolvedMentions ?? null,
  }));
  return { entities, mentions, pages, totals };
}

export const threads = kinoZodQuery({
  args: { id: zid('folders') },
  handler: async (ctx, { id }) => {
    const folder = await ownFolder(ctx, ctx.user._id, id);
    if (!folder.systemId) notFound('Folder has no system');
    const system = await ownSystem(ctx, ctx.user._id, folder.systemId);
    const settings = resolveChekhovSettings((system.metadata as { chekhov?: unknown } | undefined)?.chekhov);
    const chapters = (await chaptersOf(ctx, ctx.user._id, id)).map((c) => ({ id: c._id, title: c.title ?? null }));
    if (chapters.length === 0) return { folderId: folder._id, folderName: folder.name, chapterCount: 0, settings, threads: [] };
    const { entities, mentions } = await threadEntitiesOf(ctx, ctx.user._id, folder.systemId);
    const chapterIds = new Set(chapters.map((c) => c.id));
    return {
      folderId: folder._id,
      folderName: folder.name,
      chapterCount: chapters.length,
      settings,
      threads: detectLooseThreads({
        chapters,
        appearances: mentions.filter((m) => chapterIds.has(m.pageId)),
        entities,
        settings,
      }),
    };
  },
});

/** Cerrar guarda las menciones de ahora; reabrir borra la marca. */
export const resolveThread = kinoZodMutation({
  args: { id: zid('entities'), resolved: z.boolean() },
  handler: async (ctx, { id, resolved }) => {
    const entity = await ctx.db.get(id);
    if (!entity || entity.userId !== ctx.user._id || entity.deletedAt !== undefined) notFound('Entity not found');
    let mentions: number | undefined;
    if (resolved) {
      const { totals } = await threadEntitiesOf(ctx, ctx.user._id, entity.systemId);
      mentions = totals.get(id) ?? 0;
    }
    await ctx.db.patch(id, { threadResolvedMentions: mentions, updatedAt: Date.now() });
    return { id, threadResolvedMentions: mentions ?? null };
  },
});

// ── Cronología in-world ─────────────────────────────────────────────────────

export const timeline = kinoZodQuery({
  args: { id: zid('folders') },
  handler: async (ctx, { id }) => {
    const folder = await ownFolder(ctx, ctx.user._id, id);
    if (!folder.systemId) notFound('Folder has no system');
    const chapters = (await chaptersOf(ctx, ctx.user._id, id)).map((c) => ({ id: c._id, title: c.title ?? null }));
    const events = (await universeOf(ctx, ctx.user._id, folder.systemId)).filter((e) => e.type === 'event').sort((a, b) => a.name.localeCompare(b.name));
    const built = buildTimeline(
      await Promise.all(
        events.map(async (e) => ({
          id: e._id,
          name: e.name,
          summary: e.summary ?? null,
          attributes: (e.attributes ?? null) as EntityAttributes | null,
          narratedIn: (await ctx.db.query('pageEntityMentions').withIndex('by_entity', (q) => q.eq('entityId', e._id)).collect()).map((m) => ({
            pageId: m.pageId,
            mentionCount: m.mentionCount,
          })),
        })),
      ),
      chapters,
    );
    return { folderId: folder._id, folderName: folder.name, chapterCount: chapters.length, ...built };
  },
});

export const reorderTimeline = kinoZodMutation({
  args: { id: zid('systems'), eventIds: z.array(zid('entities')).max(500) },
  handler: async (ctx, { id, eventIds }) => {
    if (eventIds.length === 0) return { updated: 0 };
    if (new Set(eventIds).size !== eventIds.length) forbidden('The order cannot repeat an event');
    const owned = [];
    for (const eventId of eventIds) {
      const doc = await ctx.db.get(eventId);
      if (!doc || doc.userId !== ctx.user._id || doc.systemId !== id || doc.type !== 'event' || doc.deletedAt !== undefined) {
        forbidden('Every event must be a live event of this system');
      }
      owned.push(doc);
    }
    const orders = assignOrders(eventIds);
    const now = Date.now();
    for (const event of owned) {
      const attributes = (event.attributes ?? {}) as EntityAttributes;
      await ctx.db.patch(event._id, { attributes: { ...attributes, [TIMELINE_ORDER_KEY]: orders.get(event._id)! }, updatedAt: now });
    }
    return { updated: owned.length };
  },
});

export const unplaceFromTimeline = kinoZodMutation({
  args: { id: zid('entities') },
  handler: async (ctx, { id }) => {
    const event = await ctx.db.get(id);
    if (!event || event.userId !== ctx.user._id || event.deletedAt !== undefined) notFound('Entity not found');
    const attributes = { ...((event.attributes ?? {}) as EntityAttributes) };
    delete attributes[TIMELINE_ORDER_KEY];
    await ctx.db.patch(id, { attributes: Object.keys(attributes).length > 0 ? attributes : undefined, updatedAt: Date.now() });
    return null;
  },
});

// ── Rejilla de escenas ──────────────────────────────────────────────────────

async function loadScenes(ctx: Ctx, userId: Id<'users'>, folderId: Id<'folders'>) {
  const folder = await ownFolder(ctx, userId, folderId);
  if (!folder.systemId) notFound('Folder has no system');
  const chapters: ChapterScenes[] = (await chaptersOf(ctx, userId, folderId)).map((row) => ({
    chapterId: row._id,
    title: row.title ?? null,
    scenes: splitScenes(row.content ?? null),
  }));
  return { folder, systemId: folder.systemId, chapters };
}

function toGrid(folder: Doc<'folders'>, chapters: ChapterScenes[]) {
  return {
    folderId: folder._id,
    folderName: folder.name,
    arcs: listArcs(chapters),
    chapters: chapters.map((chapter) => ({
      chapterId: chapter.chapterId,
      title: chapter.title,
      scenes: chapter.scenes.map((scene) => ({
        index: scene.index,
        arc: scene.arc,
        preview: scenePreview(scene.html),
        wordCount: countWords(scene.html),
      })),
    })),
  };
}

export const plot = kinoZodQuery({
  args: { id: zid('folders') },
  handler: async (ctx, { id }) => {
    const { folder, chapters } = await loadScenes(ctx, ctx.user._id, id);
    return toGrid(folder, chapters);
  },
});

const sceneIndex = z.number().int().min(0).max(2000);
const plotOperation = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('move'),
    chapterId: zid('pages'),
    index: sceneIndex,
    toChapterId: zid('pages'),
    toIndex: sceneIndex,
    arc: z.string().trim().max(60).nullable().optional(),
  }),
  z.object({ kind: z.literal('arc'), chapterId: zid('pages'), index: sceneIndex, arc: z.string().trim().max(60).nullable() }),
]);

/**
 * Aplica un movimiento o un cambio de arco y reescribe sólo los capítulos
 * cuyo HTML cambió. El cliente manda la intención, nunca el documento.
 */
export const applyPlotOperation = kinoZodMutation({
  args: { id: zid('folders'), operation: plotOperation },
  handler: async (ctx, { id, operation }) => {
    const { folder, systemId, chapters } = await loadScenes(ctx, ctx.user._id, id);
    const before = new Map(chapters.map((c) => [c.chapterId, joinScenes(c.scenes)] as const));
    let after: ChapterScenes[];
    if (operation.kind === 'arc') {
      after = setSceneArc(chapters, { chapterId: operation.chapterId, index: operation.index }, operation.arc);
    } else {
      const from = { chapterId: operation.chapterId, index: operation.index };
      const to = { chapterId: operation.toChapterId, index: operation.toIndex };
      const landedAt = insertIndexFor(chapters, from, to);
      const moved = moveScene(chapters, from, to);
      after = 'arc' in operation ? setSceneArc(moved, { chapterId: operation.toChapterId, index: landedAt }, operation.arc ?? null) : moved;
    }
    const now = Date.now();
    for (const chapter of after) {
      const html = joinScenes(chapter.scenes);
      if (before.get(chapter.chapterId) === html) continue;
      const pageId = chapter.chapterId as Id<'pages'>;
      await ctx.db.patch(pageId, { content: html, updatedAt: now });
      await recomputePageMentions(ctx, ctx.user._id, pageId, systemId, html);
    }
    return toGrid(folder, after);
  },
});

// ── Versiones ───────────────────────────────────────────────────────────────

async function snapshotsOf(ctx: Ctx, userId: Id<'users'>, pageId: Id<'pages'>) {
  const rows = await ctx.db.query('pageSnapshots').withIndex('by_page_created', (q) => q.eq('pageId', pageId)).collect();
  return rows.filter((row) => row.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export const snapshots = kinoZodQuery({
  args: { id: zid('pages') },
  handler: async (ctx, { id }) => {
    await ownPage(ctx, ctx.user._id, id);
    const rows = await snapshotsOf(ctx, ctx.user._id, id);
    return withDeltas(
      rows.map((row) => ({
        id: row._id,
        wordCount: row.wordCount,
        createdAt: iso(row.createdAt),
        sessionStartedAt: row.sessionStartedAt === undefined ? null : iso(row.sessionStartedAt),
      })),
    );
  },
});

async function snapshotDetail(ctx: Ctx, userId: Id<'users'>, id: Id<'pageSnapshots'>) {
  const row = await ctx.db.get(id);
  if (!row || row.userId !== userId) notFound('Snapshot not found');
  const previous = (await snapshotsOf(ctx, userId, row.pageId)).find((s) => s.createdAt < row.createdAt);
  return {
    id: row._id,
    pageId: row.pageId,
    content: row.content ?? null,
    wordCount: row.wordCount,
    wordsDelta: row.wordCount - (previous?.wordCount ?? 0),
    createdAt: iso(row.createdAt),
    sessionStartedAt: row.sessionStartedAt === undefined ? null : iso(row.sessionStartedAt),
  };
}

export const snapshot = kinoZodQuery({
  args: { id: zid('pageSnapshots') },
  handler: async (ctx, { id }) => snapshotDetail(ctx, ctx.user._id, id),
});

/** Vuelve a una versión; antes guarda la actual, para que restaurar nunca pierda nada. */
export const restoreSnapshot = kinoZodMutation({
  args: { id: zid('pageSnapshots') },
  handler: async (ctx, { id }) => {
    const target = await snapshotDetail(ctx, ctx.user._id, id);
    const page = await ownPage(ctx, ctx.user._id, target.pageId);
    if ((page.content ?? null) === target.content) return { pageId: page._id, content: page.content ?? null };
    await captureSnapshot(ctx, page, page.content, undefined);
    await ctx.db.patch(page._id, { content: target.content ?? undefined, updatedAt: Date.now() });
    return { pageId: page._id, content: target.content };
  },
});

// ── Sesiones y capítulos ────────────────────────────────────────────────────

/**
 * Cierra una sesión cronometrada. No inserta otra fila: refina la sesión
 * detectada que cubre esa ventana y se queda con el mayor de los dos tiempos.
 */
export const closeSession = kinoZodMutation({
  args: {
    id: zid('pages'),
    startedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida'),
    endedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida'),
    durationMinutes: z.number().int().min(0).max(24 * 60),
  },
  handler: async (ctx, { id, startedAt, endedAt, durationMinutes }) => {
    const page = await ownPage(ctx, ctx.user._id, id);
    if (!page.systemId) notFound('Page has no system');
    const started = Date.parse(startedAt);
    const ended = Date.parse(endedAt);
    const [open] = (await writingSessionsOf(ctx, ctx.user._id, id)).filter((log) => (log.endedAt ?? 0) >= started);
    if (!open) {
      await ctx.db.insert('timeLogs', {
        userId: ctx.user._id,
        systemId: page.systemId,
        pageId: id,
        startedAt: started,
        endedAt: ended,
        durationMinutes,
        wordsWritten: 0,
        source: 'writing',
        createdAt: Date.now(),
      });
      return { durationMinutes, wordsWritten: 0 };
    }
    const merged = Math.max(open.durationMinutes, durationMinutes);
    await ctx.db.patch(open._id, {
      startedAt: Math.min(open.startedAt, started),
      endedAt: Math.max(open.endedAt ?? ended, ended),
      durationMinutes: merged,
    });
    return { durationMinutes: merged, wordsWritten: open.wordsWritten ?? 0 };
  },
});

export const setCompleted = kinoZodMutation({
  args: { id: zid('pages'), completed: z.boolean() },
  handler: async (ctx, { id, completed }) => {
    await ownPage(ctx, ctx.user._id, id);
    const now = Date.now();
    await ctx.db.patch(id, {
      completedAt: completed ? now : undefined,
      completedBy: completed ? ctx.user._id : undefined,
      completedVia: completed ? ctx.channel : undefined,
      updatedAt: now,
    });
    return { id, completedAt: completed ? iso(now) : null };
  },
});

// ── El estudio ──────────────────────────────────────────────────────────────

export const studio = kinoZodQuery({
  args: { id: zid('systems') },
  handler: async (ctx, { id }) => {
    const userId = ctx.user._id;
    const summary = await overviewOf(ctx, ctx.user, id);
    const system = await ownSystem(ctx, userId, id);
    const works = (await ctx.db.query('folders').withIndex('by_system', (q) => q.eq('systemId', id)).collect()).filter(
      (f) => f.userId === userId && f.deletedAt === undefined,
    );
    const pages = await systemPages(ctx, userId, id);
    const { entities, mentions, totals } = await threadEntitiesOf(ctx, userId, id);

    // Entidades muy nombradas y sin una línea que las describa.
    const chaptersByEntity = new Map<string, Set<string>>();
    for (const m of mentions) chaptersByEntity.set(m.entityId, (chaptersByEntity.get(m.entityId) ?? new Set()).add(m.pageId));
    const universe = await universeOf(ctx, userId, id);
    const codexGaps = universe
      .filter((e) => e.summary === undefined && e.attributes === undefined && (totals.get(e._id) ?? 0) > 0)
      .map((e) => ({ entityId: e._id, name: e.name, mentions: totals.get(e._id) ?? 0, chapters: chaptersByEntity.get(e._id)?.size ?? 0 }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 5);

    const settings = resolveChekhovSettings((system.metadata as { chekhov?: unknown } | undefined)?.chekhov);
    let looseThreadCount = 0;
    for (const work of works) {
      const chapters = pages.filter((p) => p.folderId === work._id).map((p) => ({ id: p._id, title: p.title ?? null }));
      if (chapters.length === 0) continue;
      looseThreadCount += detectLooseThreads({ chapters, appearances: mentions, entities, settings }).filter((t) => !t.resolved).length;
    }

    const open = pages.filter((p) => p.completedAt === undefined).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const openFolder = open?.folderId ? await ctx.db.get(open.folderId) : null;
    const stalest = [...summary.works].filter((w) => w.daysSinceLastSession !== null).sort((a, b) => (b.daysSinceLastSession ?? 0) - (a.daysSinceLastSession ?? 0))[0];
    const worksById = new Map(works.map((w) => [w._id as string, w.name]));

    const signals: StudioSignals = {
      openChapter: open
        ? {
            pageId: open._id,
            title: open.title ?? null,
            folderName: openFolder?.name ?? 'sin obra',
            wordCount: countWords(open.content ?? null),
            daysSinceEdit: Math.max(0, Math.floor((Date.now() - open.updatedAt) / DAY_MS)),
          }
        : null,
      staleWork: stalest
        ? { folderId: stalest.folderId, name: worksById.get(stalest.folderId) ?? 'la obra', daysSinceLastSession: stalest.daysSinceLastSession ?? 0 }
        : null,
      wordsToday: summary.wordsToday,
      dailyWordGoal: summary.dailyWordGoal,
      peakWindow: summary.peakWindow,
      currentHour: summary.currentHour,
      looseThreadCount,
      hasAnyChapter: pages.length > 0 || works.length > 0,
    };
    return { systemId: id, suggestions: buildSuggestions(signals), codexGaps, looseThreadCount };
  },
});

/** Resumen extractivo de un capítulo, con el codex como pista de peso. */
export const chapterSummary = kinoZodQuery({
  args: { id: zid('pages') },
  handler: async (ctx, { id }) => {
    const page = await ownPage(ctx, ctx.user._id, id);
    const universe = page.systemId ? await universeOf(ctx, ctx.user._id, page.systemId) : [];
    const text = toPlainText(page.content ?? null);
    return {
      pageId: page._id,
      title: page.title ?? null,
      wordCount: countWords(page.content ?? null),
      sentences: summarize({ text, entityNames: universe.flatMap((e) => [e.name, ...e.aliases]) }),
      keyTerms: keyTerms(text),
    };
  },
});
