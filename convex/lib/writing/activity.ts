import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';
import { countWords } from '../../../src/shared/lib/word-count';
import { MAX_SNAPSHOTS_PER_PAGE } from '../../../src/features/writing/snapshots';

// Sesiones de escritura detectadas por actividad y las versiones de capítulo
// que nacen al cerrarse una. Un guardado que no mueve nada no es una sesión.

/** Minutos sin guardar que separan dos sesiones. */
export const SESSION_GAP_MINUTES = 20;

/** Sesiones de escritura de una página, la más reciente primero. */
export async function writingSessionsOf(ctx: QueryCtx | MutationCtx, userId: Id<'users'>, pageId: Id<'pages'>) {
  const logs = await ctx.db
    .query('timeLogs')
    .withIndex('by_user_page_started', (q) => q.eq('userId', userId).eq('pageId', pageId))
    .collect();
  return logs.filter((log) => log.source === 'writing').sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Guarda cómo quedó el capítulo al cerrarse una sesión. Un capítulo en blanco
 * o idéntico a la última versión no genera otra; sobreviven las últimas N.
 */
export async function captureSnapshot(
  ctx: MutationCtx,
  page: Doc<'pages'>,
  content: string | undefined,
  sessionStartedAt: number | undefined,
) {
  if (!content || content.trim() === '') return;
  const existing = (await ctx.db.query('pageSnapshots').withIndex('by_page_created', (q) => q.eq('pageId', page._id)).collect()).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  if (existing[0]?.content === content) return;
  await ctx.db.insert('pageSnapshots', {
    pageId: page._id,
    userId: page.userId,
    systemId: page.systemId,
    content,
    wordCount: countWords(content),
    sessionStartedAt,
    createdAt: Date.now(),
  });
  for (const old of existing.slice(MAX_SNAPSHOTS_PER_PAGE - 1)) await ctx.db.delete(old._id);
}

/**
 * Registra actividad sobre un capítulo: extiende la sesión abierta si el
 * último guardado fue hace menos del hueco, y si no abre una, archivando
 * antes el texto anterior como versión.
 */
export async function recordWritingActivity(
  ctx: MutationCtx,
  page: Doc<'pages'>,
  wordsDelta: number,
  previousContent: string | undefined,
) {
  if (!page.systemId) return;
  const now = Date.now();
  const cutoff = now - SESSION_GAP_MINUTES * 60_000;
  const [open] = (await writingSessionsOf(ctx, page.userId, page._id)).filter((log) => (log.endedAt ?? 0) >= cutoff);
  if (open) {
    await ctx.db.patch(open._id, {
      endedAt: now,
      durationMinutes: Math.max(0, Math.round((now - open.startedAt) / 60_000)),
      wordsWritten: (open.wordsWritten ?? 0) + wordsDelta,
    });
    return;
  }
  await captureSnapshot(ctx, page, previousContent, undefined);
  await ctx.db.insert('timeLogs', {
    userId: page.userId,
    systemId: page.systemId,
    pageId: page._id,
    startedAt: now,
    endedAt: now,
    durationMinutes: 0,
    wordsWritten: wordsDelta,
    source: 'writing',
    createdAt: now,
  });
}
