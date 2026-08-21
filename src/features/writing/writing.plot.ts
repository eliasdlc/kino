import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/shared/db";
import { folders, pages } from "@/shared/db/schema";
import { recomputePageMentions } from "@/features/entities/entities.service";
import { countWords } from "@/shared/lib/word-count";
import {
  insertIndexFor,
  joinScenes,
  listArcs,
  moveScene,
  scenePreview,
  setSceneArc,
  splitScenes,
  type ChapterScenes,
} from "./plot-grid";

/**
 * Capa de datos del plot grid (KIN-141).
 *
 * Todas las operaciones son **autoritativas del servidor**: se releen los
 * capítulos, se parten en escenas, se aplica el movimiento y se reescribe el HTML
 * en una transacción. El cliente manda la intención, nunca el documento — así una
 * pestaña con el texto viejo no puede sobrescribir lo que se escribió en otra.
 */

export interface PlotScene {
  index: number;
  arc: string | null;
  preview: string;
  wordCount: number;
}

export interface PlotChapter {
  chapterId: string;
  title: string | null;
  scenes: PlotScene[];
}

export interface PlotGrid {
  folderId: string;
  folderName: string;
  arcs: string[];
  chapters: PlotChapter[];
}

/** Capítulos con su contenido, en orden de obra. Exportada para el test de SQL. */
export function plotChaptersQuery(folderId: string, userId: string) {
  return db
    .select({ id: pages.id, title: pages.title, content: pages.content })
    .from(pages)
    .where(
      and(
        eq(pages.folderId, folderId),
        eq(pages.userId, userId),
        isNull(pages.deletedAt),
      ),
    )
    .orderBy(asc(pages.createdAt));
}

async function loadChapters(
  userId: string,
  folderId: string,
): Promise<{ systemId: string; name: string; chapters: ChapterScenes[] } | null> {
  const [folder] = await db
    .select({ id: folders.id, name: folders.name, systemId: folders.systemId })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .limit(1);

  if (!folder?.systemId) return null;

  const rows = await plotChaptersQuery(folderId, userId);
  return {
    systemId: folder.systemId,
    name: folder.name,
    chapters: rows.map((row) => ({
      chapterId: row.id,
      title: row.title,
      scenes: splitScenes(row.content),
    })),
  };
}

function toGrid(folderId: string, name: string, chapters: ChapterScenes[]): PlotGrid {
  return {
    folderId,
    folderName: name,
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

export async function getPlotGrid(
  userId: string,
  folderId: string,
): Promise<PlotGrid | null> {
  const loaded = await loadChapters(userId, folderId);
  if (!loaded) return null;
  return toGrid(folderId, loaded.name, loaded.chapters);
}

export type PlotOperation =
  | {
      kind: "move";
      chapterId: string;
      index: number;
      toChapterId: string;
      toIndex: number;
      /**
       * Arco que toma la escena al aterrizar. Soltar una tarjeta en una celda es
       * un solo gesto —mover y reasignar arco—, así que tiene que ser una sola
       * operación: dos peticiones seguidas podrían llegar en orden inverso y la
       * segunda trabajaría sobre índices que ya cambiaron.
       */
      arc?: string | null;
    }
  | { kind: "arc"; chapterId: string; index: number; arc: string | null };

/** Aplica la operación sobre las escenas, sin tocar la base. */
function applyOperation(
  chapters: ChapterScenes[],
  operation: PlotOperation,
): ChapterScenes[] {
  if (operation.kind === "arc") {
    return setSceneArc(
      chapters,
      { chapterId: operation.chapterId, index: operation.index },
      operation.arc,
    );
  }

  const from = { chapterId: operation.chapterId, index: operation.index };
  const to = { chapterId: operation.toChapterId, index: operation.toIndex };
  // Dónde cae la escena hay que preguntarlo antes de mover: después, los índices
  // ya son otros.
  const landedAt = insertIndexFor(chapters, from, to);
  const moved = moveScene(chapters, from, to);

  if (!("arc" in operation)) return moved;
  return setSceneArc(moved, { chapterId: operation.toChapterId, index: landedAt }, operation.arc ?? null);
}

/**
 * Aplica una operación y devuelve la rejilla resultante. Solo se reescriben los
 * capítulos cuyo HTML cambió de verdad: mover una escena dentro de su capítulo no
 * tiene por qué tocar la fecha de los demás.
 */
export async function applyPlotOperation(
  userId: string,
  folderId: string,
  operation: PlotOperation,
): Promise<PlotGrid | null> {
  const loaded = await loadChapters(userId, folderId);
  if (!loaded) return null;

  const before = new Map(
    loaded.chapters.map((c) => [c.chapterId, joinScenes(c.scenes)] as const),
  );

  const after = applyOperation(loaded.chapters, operation);

  const changed = after
    .map((chapter) => ({ chapter, html: joinScenes(chapter.scenes) }))
    .filter(({ chapter, html }) => before.get(chapter.chapterId) !== html);

  if (changed.length > 0) {
    const now = new Date();
    await db.transaction(async (tx) => {
      for (const { chapter, html } of changed) {
        await tx
          .update(pages)
          .set({ content: html, updatedAt: now })
          .where(and(eq(pages.id, chapter.chapterId), eq(pages.userId, userId)));
      }
    });

    // Mover una escena cambia en qué capítulo se menciona cada entidad. El índice
    // del codex es derivado y best-effort, igual que al guardar una página: un
    // fallo aquí no puede tumbar un movimiento que ya se escribió.
    for (const { chapter, html } of changed) {
      try {
        await recomputePageMentions(chapter.chapterId, loaded.systemId, userId, html);
      } catch (err) {
        console.error("recomputePageMentions failed", { pageId: chapter.chapterId, err });
      }
    }
  }

  return toGrid(folderId, loaded.name, after);
}
