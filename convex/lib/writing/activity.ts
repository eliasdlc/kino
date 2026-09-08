import type { Doc, Id } from '../../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../../_generated/server';

// Sesiones de escritura detectadas por actividad. Un guardado que no mueve nada
// no es una sesión.
//
// Las versiones del capítulo ya no se escriben aquí: viven en
// `convex/lib/pages/snapshots.ts`, porque son el soporte del deshacer de los
// siete arquetipos y no una pieza del arquetipo de escritura.

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
 * Registra actividad sobre un capítulo: extiende la sesión abierta si el último
 * guardado fue hace menos del hueco, y si no abre una nueva.
 */
export async function recordWritingActivity(ctx: MutationCtx, page: Doc<'pages'>, wordsDelta: number): Promise<void> {
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
