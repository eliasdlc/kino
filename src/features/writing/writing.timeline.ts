import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/shared/db";
import { entities, folders, pageEntityMentions, pages } from "@/shared/db/schema";
import { ForbiddenError } from "@/shared/utils/error";
import type { EntityAttributes } from "@/features/entities/entities.attributes";
import {
  TIMELINE_ORDER_KEY,
  assignOrders,
  buildTimeline,
  type TimelineReport,
} from "./timeline";

/**
 * Capa de datos de la cronología in-world (KIN-140). Reúne los eventos del
 * sistema con sus menciones y los cruza con los capítulos de una obra para poder
 * comparar las dos líneas de tiempo: la de la historia y la del manuscrito.
 */

/** Menciones de un conjunto de entidades. Exportada para compilarla a SQL. */
export function eventMentionsQuery(eventIds: string[]) {
  return db
    .select({
      entityId: pageEntityMentions.entityId,
      pageId: pageEntityMentions.pageId,
      mentionCount: pageEntityMentions.mentionCount,
    })
    .from(pageEntityMentions)
    .where(inArray(pageEntityMentions.entityId, eventIds));
}

/** Eventos del universo de un sistema, en el orden de creación como base. */
export function systemEventsQuery(systemId: string, userId: string) {
  return db
    .select({
      id: entities.id,
      name: entities.name,
      summary: entities.summary,
      attributes: entities.attributes,
    })
    .from(entities)
    .where(
      and(
        eq(entities.systemId, systemId),
        eq(entities.userId, userId),
        eq(entities.type, "event"),
        isNull(entities.deletedAt),
      ),
    )
    .orderBy(entities.name);
}

export async function getTimeline(
  userId: string,
  folderId: string,
): Promise<TimelineReport | null> {
  const [folder] = await db
    .select({ id: folders.id, name: folders.name, systemId: folders.systemId })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .limit(1);

  if (!folder?.systemId) return null;

  const [chapters, events] = await Promise.all([
    db
      .select({ id: pages.id, title: pages.title })
      .from(pages)
      .where(
        and(
          eq(pages.folderId, folderId),
          eq(pages.userId, userId),
          isNull(pages.deletedAt),
        ),
      )
      .orderBy(asc(pages.createdAt)),
    systemEventsQuery(folder.systemId, userId),
  ]);

  const mentions = events.length ? await eventMentionsQuery(events.map((e) => e.id)) : [];
  const byEntity = new Map<string, Array<{ pageId: string; mentionCount: number }>>();
  for (const m of mentions) {
    const list = byEntity.get(m.entityId) ?? [];
    list.push({ pageId: m.pageId, mentionCount: m.mentionCount });
    byEntity.set(m.entityId, list);
  }

  const timeline = buildTimeline(
    events.map((e) => ({
      id: e.id,
      name: e.name,
      summary: e.summary,
      attributes: e.attributes as EntityAttributes | null,
      narratedIn: byEntity.get(e.id) ?? [],
    })),
    chapters,
  );

  return {
    folderId: folder.id,
    folderName: folder.name,
    chapterCount: chapters.length,
    ...timeline,
  };
}

/**
 * Reescribe el orden in-world de una tanda de eventos. La posición vive dentro
 * de `attributes` de la entidad (jsonb ya validado por el manifiesto), así que
 * no hace falta tabla ni columna nueva: solo se reemplaza esa clave y se deja el
 * resto de la ficha intacta.
 *
 * Un id que no sea del usuario aborta la operación entera — reordenar a medias
 * dejaría la cronología en un estado que nadie pidió.
 */
export async function reorderTimeline(
  userId: string,
  systemId: string,
  orderedIds: string[],
): Promise<number> {
  if (orderedIds.length === 0) return 0;
  // Un id repetido dejaría a otro evento sin posición y no hay lectura sensata
  // de qué quiso decir el cliente: es un error, no algo que normalizar.
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new ForbiddenError("The order cannot repeat an event");
  }

  const owned = await db
    .select({ id: entities.id, attributes: entities.attributes })
    .from(entities)
    .where(
      and(
        inArray(entities.id, orderedIds),
        eq(entities.systemId, systemId),
        eq(entities.userId, userId),
        eq(entities.type, "event"),
        isNull(entities.deletedAt),
      ),
    );

  if (owned.length !== orderedIds.length) {
    throw new ForbiddenError("Every event must be a live event of this system");
  }

  const orders = assignOrders(orderedIds);
  const now = new Date();

  await db.transaction(async (tx) => {
    for (const event of owned) {
      const attributes = (event.attributes as EntityAttributes | null) ?? {};
      await tx
        .update(entities)
        .set({
          attributes: { ...attributes, [TIMELINE_ORDER_KEY]: orders.get(event.id)! },
          updatedAt: now,
        })
        .where(eq(entities.id, event.id));
    }
  });

  return owned.length;
}

/** Saca un evento de la cronología sin tocar el resto de su ficha. */
export async function unplaceFromTimeline(
  userId: string,
  entityId: string,
): Promise<boolean> {
  const [event] = await db
    .select({ id: entities.id, attributes: entities.attributes })
    .from(entities)
    .where(
      and(
        eq(entities.id, entityId),
        eq(entities.userId, userId),
        isNull(entities.deletedAt),
      ),
    )
    .limit(1);

  if (!event) return false;

  const attributes = { ...((event.attributes as EntityAttributes | null) ?? {}) };
  delete attributes[TIMELINE_ORDER_KEY];

  await db
    .update(entities)
    .set({
      attributes: Object.keys(attributes).length > 0 ? attributes : null,
      updatedAt: new Date(),
    })
    .where(eq(entities.id, entityId));

  return true;
}
