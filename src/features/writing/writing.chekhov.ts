import { and, asc, eq, isNull, inArray, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { entities, folders, pageEntityMentions, pages, systems } from "@/shared/db/schema";
import { ForbiddenError } from "@/shared/utils/error";
import {
  CHEKHOV_LIMITS,
  DEFAULT_CHEKHOV,
  detectLooseThreads,
  type ChekhovSettings,
  type LooseThreadsReport,
  type ThreadEntity,
} from "./chekhov";

/**
 * Capa de datos del detector de hilos sueltos (KIN-137). El criterio vive puro en
 * `chekhov.ts`; aquí solo se reúnen los tres ingredientes —capítulos en orden,
 * apariciones y universo— y se aplican los umbrales del sistema.
 */

/**
 * Menciones de las entidades de un sistema, por entidad. Da el conteo con el que
 * se compara un hilo cerrado. Exportada para compilarla a SQL en un test: el join
 * a `pages` es justo lo que drizzle solo grita en runtime.
 */
export function systemMentionTotalsQuery(systemId: string, userId: string) {
  return db
    .select({
      entityId: pageEntityMentions.entityId,
      total: sql<number>`SUM(${pageEntityMentions.mentionCount})::int`,
    })
    .from(pageEntityMentions)
    .innerJoin(pages, eq(pageEntityMentions.pageId, pages.id))
    .where(
      and(
        eq(pages.systemId, systemId),
        eq(pages.userId, userId),
        isNull(pages.deletedAt),
      ),
    )
    .groupBy(pageEntityMentions.entityId);
}

/** Apariciones dentro de los capítulos de una obra. */
export function workAppearancesQuery(chapterIds: string[]) {
  return db
    .select({
      entityId: pageEntityMentions.entityId,
      pageId: pageEntityMentions.pageId,
      mentionCount: pageEntityMentions.mentionCount,
    })
    .from(pageEntityMentions)
    .where(inArray(pageEntityMentions.pageId, chapterIds));
}

/** Umbrales efectivos: los del sistema si los tiene, si no los conservadores. */
export function resolveChekhovSettings(raw: unknown): ChekhovSettings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_CHEKHOV;
  const value = raw as Partial<ChekhovSettings>;
  return {
    maxMentions: clampSetting(value.maxMentions, DEFAULT_CHEKHOV.maxMentions, CHEKHOV_LIMITS.maxMentions),
    minSilentChapters: clampSetting(
      value.minSilentChapters,
      DEFAULT_CHEKHOV.minSilentChapters,
      CHEKHOV_LIMITS.minSilentChapters,
    ),
  };
}

function clampSetting(
  value: unknown,
  fallback: number,
  limits: { min: number; max: number },
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}

/**
 * Hilos sueltos de una obra. Los capítulos van en orden de creación, que es el
 * orden de lectura de la obra en todo el Writing System (§7): el silencio se mide
 * en capítulos, no en días.
 */
export async function getLooseThreads(
  userId: string,
  folderId: string,
): Promise<LooseThreadsReport | null> {
  const [folder] = await db
    .select({ id: folders.id, name: folders.name, systemId: folders.systemId })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .limit(1);

  if (!folder?.systemId) return null;

  const [system] = await db
    .select({ metadata: systems.metadata })
    .from(systems)
    .where(and(eq(systems.id, folder.systemId), eq(systems.userId, userId)))
    .limit(1);

  const settings = resolveChekhovSettings(system?.metadata?.chekhov);

  const chapters = await db
    .select({ id: pages.id, title: pages.title })
    .from(pages)
    .where(
      and(
        eq(pages.folderId, folderId),
        eq(pages.userId, userId),
        isNull(pages.deletedAt),
      ),
    )
    .orderBy(asc(pages.createdAt));

  if (chapters.length === 0) {
    return {
      folderId: folder.id,
      folderName: folder.name,
      chapterCount: 0,
      settings,
      threads: [],
    };
  }

  const [universe, appearances, totals] = await Promise.all([
    db
      .select({
        id: entities.id,
        name: entities.name,
        type: entities.type,
        threadResolvedMentions: entities.threadResolvedMentions,
      })
      .from(entities)
      .where(
        and(
          eq(entities.systemId, folder.systemId),
          eq(entities.userId, userId),
          isNull(entities.deletedAt),
        ),
      ),
    workAppearancesQuery(chapters.map((c) => c.id)),
    systemMentionTotalsQuery(folder.systemId, userId),
  ]);

  const totalById = new Map(totals.map((t) => [t.entityId, t.total ?? 0]));
  const threadEntities: ThreadEntity[] = universe.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    mentionsInSystem: totalById.get(e.id) ?? 0,
    threadResolvedMentions: e.threadResolvedMentions,
  }));

  return {
    folderId: folder.id,
    folderName: folder.name,
    chapterCount: chapters.length,
    settings,
    threads: detectLooseThreads({
      chapters,
      appearances,
      entities: threadEntities,
      settings,
    }),
  };
}

/**
 * Cierra o reabre un hilo. Cerrar guarda las menciones que la entidad tiene
 * **ahora** en el sistema; reabrir borra la marca. No hay estado intermedio que
 * mantener sincronizado: el detector vuelve a derivarlo todo en la siguiente
 * lectura.
 */
export async function setThreadResolved(
  entityId: string,
  userId: string,
  resolved: boolean,
): Promise<{ id: string; threadResolvedMentions: number | null } | null> {
  const [entity] = await db
    .select({ id: entities.id, systemId: entities.systemId })
    .from(entities)
    .where(
      and(
        eq(entities.id, entityId),
        eq(entities.userId, userId),
        isNull(entities.deletedAt),
      ),
    )
    .limit(1);

  if (!entity) return null;

  let mentions: number | null = null;
  if (resolved) {
    const totals = await systemMentionTotalsQuery(entity.systemId, userId);
    mentions = totals.find((t) => t.entityId === entityId)?.total ?? 0;
  }

  const [updated] = await db
    .update(entities)
    .set({ threadResolvedMentions: mentions, updatedAt: new Date() })
    .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
    .returning({
      id: entities.id,
      threadResolvedMentions: entities.threadResolvedMentions,
    });

  if (!updated) throw new ForbiddenError("Entity does not belong to this user");
  return updated;
}
