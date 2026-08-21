import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/shared/db";
import { pageSnapshots, pages } from "@/shared/db/schema";
import { countWords } from "@/shared/lib/word-count";
import {
  MAX_SNAPSHOTS_PER_PAGE,
  withDeltas,
  type SnapshotDetail,
  type SnapshotListItem,
} from "./snapshots";

/**
 * Versionado de capítulos (KIN-142): una foto del texto por **sesión de
 * escritura**. El punto de corte no se inventa — desde W4 las sesiones se
 * detectan solas agrupando los guardados por hueco de 20 min, así que cuando el
 * detector abre una sesión nueva, lo que había antes es exactamente "cómo quedó
 * el capítulo la última vez que paraste".
 *
 * El aviso del ticket era el coste: un snapshot por sesión de una novela larga
 * crece rápido y el free tier de Neon tiene techo. Dos frenos, los dos baratos:
 *
 * 1. **Dedupe.** Si el texto no cambió desde la última foto, no se guarda otra.
 *    Volver a abrir un capítulo para releerlo no genera versiones.
 * 2. **Poda.** Solo sobreviven las últimas `MAX_SNAPSHOTS_PER_PAGE` por capítulo.
 *
 * Guardar diffs en vez del texto completo comprimiría mucho más, y es la salida
 * si el volumen llega a molestar. Hoy no compensa la complejidad de reconstruir.
 */


/** Versiones de un capítulo, de la más reciente a la más vieja. */
export function snapshotsForPageQuery(pageId: string, userId: string) {
  return db
    .select({
      id: pageSnapshots.id,
      wordCount: pageSnapshots.wordCount,
      createdAt: pageSnapshots.createdAt,
      sessionStartedAt: pageSnapshots.sessionStartedAt,
    })
    .from(pageSnapshots)
    .where(and(eq(pageSnapshots.pageId, pageId), eq(pageSnapshots.userId, userId)))
    .orderBy(desc(pageSnapshots.createdAt));
}

/**
 * Guarda cómo quedó el capítulo al cerrarse una sesión. Best-effort desde el
 * llamador: el guardado de la página nunca puede caerse porque el historial
 * falle — la próxima sesión vuelve a intentarlo.
 */
export async function captureSnapshot({
  pageId,
  userId,
  content,
  sessionStartedAt,
}: {
  pageId: string;
  userId: string;
  /** Texto **anterior** al guardado en curso: el resultado de la sesión que cierra. */
  content: string | null;
  sessionStartedAt: Date | null;
}): Promise<void> {
  // Un capítulo en blanco no es una versión a la que nadie quiera volver.
  if (!content || content.trim() === "") return;

  const [last] = await db
    .select({ id: pageSnapshots.id, content: pageSnapshots.content })
    .from(pageSnapshots)
    .where(and(eq(pageSnapshots.pageId, pageId), eq(pageSnapshots.userId, userId)))
    .orderBy(desc(pageSnapshots.createdAt))
    .limit(1);

  if (last?.content === content) return;

  await db.insert(pageSnapshots).values({
    pageId,
    userId,
    content,
    wordCount: countWords(content),
    sessionStartedAt,
  });

  await pruneSnapshots(pageId, userId);
}

/** Deja solo las últimas N versiones del capítulo. */
export async function pruneSnapshots(pageId: string, userId: string): Promise<number> {
  const rows = await db
    .select({ id: pageSnapshots.id, createdAt: pageSnapshots.createdAt })
    .from(pageSnapshots)
    .where(and(eq(pageSnapshots.pageId, pageId), eq(pageSnapshots.userId, userId)))
    .orderBy(desc(pageSnapshots.createdAt))
    .offset(MAX_SNAPSHOTS_PER_PAGE)
    .limit(1);

  const cutoff = rows[0]?.createdAt;
  if (!cutoff) return 0;

  // Se borra por fecha y no por lista de ids: si entraron versiones nuevas entre
  // la lectura y el borrado, el corte sigue siendo el correcto.
  const deleted = await db
    .delete(pageSnapshots)
    .where(
      and(
        eq(pageSnapshots.pageId, pageId),
        eq(pageSnapshots.userId, userId),
        lt(pageSnapshots.createdAt, cutoff),
      ),
    )
    .returning({ id: pageSnapshots.id });

  return deleted.length;
}

/** Historial de un capítulo, con el delta de palabras contra la versión previa. */
export async function listSnapshots(
  pageId: string,
  userId: string,
): Promise<SnapshotListItem[]> {
  const rows = await snapshotsForPageQuery(pageId, userId);
  return withDeltas(
    rows.map((row) => ({
      id: row.id,
      wordCount: row.wordCount,
      createdAt: row.createdAt.toISOString(),
      sessionStartedAt: row.sessionStartedAt?.toISOString() ?? null,
    })),
  );
}

export async function getSnapshot(
  snapshotId: string,
  userId: string,
): Promise<SnapshotDetail | null> {
  const [row] = await db
    .select()
    .from(pageSnapshots)
    .where(and(eq(pageSnapshots.id, snapshotId), eq(pageSnapshots.userId, userId)))
    .limit(1);

  if (!row) return null;

  const [previous] = await db
    .select({ wordCount: pageSnapshots.wordCount })
    .from(pageSnapshots)
    .where(
      and(
        eq(pageSnapshots.pageId, row.pageId),
        eq(pageSnapshots.userId, userId),
        lt(pageSnapshots.createdAt, row.createdAt),
      ),
    )
    .orderBy(desc(pageSnapshots.createdAt))
    .limit(1);

  return {
    id: row.id,
    pageId: row.pageId,
    content: row.content,
    wordCount: row.wordCount,
    wordsDelta: row.wordCount - (previous?.wordCount ?? 0),
    createdAt: row.createdAt.toISOString(),
    sessionStartedAt: row.sessionStartedAt?.toISOString() ?? null,
  };
}

/**
 * Devuelve el capítulo a una versión anterior. Antes de escribir, guarda el
 * estado actual: restaurar nunca puede ser la operación que te hace perder lo
 * que tenías.
 */
export async function restoreSnapshot(
  snapshotId: string,
  userId: string,
): Promise<{ pageId: string; content: string | null } | null> {
  const snapshot = await getSnapshot(snapshotId, userId);
  if (!snapshot) return null;

  const [page] = await db
    .select({ id: pages.id, content: pages.content })
    .from(pages)
    .where(
      and(
        eq(pages.id, snapshot.pageId),
        eq(pages.userId, userId),
        isNull(pages.deletedAt),
      ),
    )
    .limit(1);

  if (!page) return null;
  if (page.content === snapshot.content) {
    return { pageId: page.id, content: page.content };
  }

  await captureSnapshot({
    pageId: page.id,
    userId,
    content: page.content,
    sessionStartedAt: null,
  });

  await db
    .update(pages)
    .set({ content: snapshot.content, updatedAt: new Date() })
    .where(and(eq(pages.id, page.id), eq(pages.userId, userId)));

  return { pageId: page.id, content: snapshot.content };
}
