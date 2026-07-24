import { db } from "@/shared/db";
import {
  entities,
  entityRelations,
  pageEntityMentions,
  pages,
  systems,
} from "@/shared/db/schema";
import { and, eq, or, isNull, inArray, desc } from "drizzle-orm";
import { ForbiddenError } from "@/shared/utils/error";
import type {
  CreateEntityInput,
  UpdateEntityInput,
  CreateRelationInput,
} from "./entities.schemas";
import type {
  EntityListItem,
  EntityDetail,
  EntityRelationItem,
  EntityAppearance,
  MentionedEntity,
} from "./entities.types";
import type { EntityType } from "./entities.attributes";
import { parseEntityAttributes } from "./entities.attributes";
import { detectMentions, plainTextFromHtml } from "./entities.detection";

/** Lanza si el sistema no existe o no es del usuario. */
async function assertSystemOwnership(systemId: string, userId: string): Promise<void> {
  const [system] = await db
    .select({ id: systems.id })
    .from(systems)
    .where(and(eq(systems.id, systemId), eq(systems.userId, userId)));
  if (!system) throw new ForbiddenError("System does not belong to this user");
}

// ── lecturas ──

export async function listEntities(
  systemId: string,
  userId: string,
): Promise<EntityListItem[]> {
  return db
    .select({
      id: entities.id,
      systemId: entities.systemId,
      type: entities.type,
      name: entities.name,
      aliases: entities.aliases,
      summary: entities.summary,
      coverImageUrl: entities.coverImageUrl,
      createdAt: entities.createdAt,
      updatedAt: entities.updatedAt,
    })
    .from(entities)
    .where(
      and(
        eq(entities.systemId, systemId),
        eq(entities.userId, userId),
        isNull(entities.deletedAt),
      ),
    )
    .orderBy(entities.name);
}

export async function getEntityById(
  entityId: string,
  userId: string,
): Promise<EntityDetail | null> {
  const [entity] = await db
    .select()
    .from(entities)
    .where(
      and(
        eq(entities.id, entityId),
        eq(entities.userId, userId),
        isNull(entities.deletedAt),
      ),
    );
  if (!entity) return null;

  const [relations, appearances] = await Promise.all([
    getRelationsForEntity(entityId),
    getAppearancesForEntity(entityId),
  ]);

  return {
    id: entity.id,
    systemId: entity.systemId,
    type: entity.type,
    name: entity.name,
    aliases: entity.aliases,
    summary: entity.summary,
    coverImageUrl: entity.coverImageUrl,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    attributes: entity.attributes as Record<string, string> | null,
    images: entity.images,
    relations,
    appearances,
  };
}

async function getRelationsForEntity(entityId: string): Promise<EntityRelationItem[]> {
  const rows = await db
    .select({
      id: entityRelations.id,
      fromEntityId: entityRelations.fromEntityId,
      toEntityId: entityRelations.toEntityId,
      label: entityRelations.label,
      notes: entityRelations.notes,
      otherFromId: entities.id,
      otherFromName: entities.name,
      otherFromType: entities.type,
    })
    .from(entityRelations)
    .where(
      or(
        eq(entityRelations.fromEntityId, entityId),
        eq(entityRelations.toEntityId, entityId),
      ),
    );

  if (rows.length === 0) return [];

  // Resolver la entidad al otro extremo (la que no es `entityId`), viva.
  const otherIds = rows.map((r) =>
    r.fromEntityId === entityId ? r.toEntityId : r.fromEntityId,
  );
  const others = await db
    .select({ id: entities.id, name: entities.name, type: entities.type })
    .from(entities)
    .where(and(inArray(entities.id, otherIds), isNull(entities.deletedAt)));
  const byId = new Map(others.map((o) => [o.id, o]));

  const items: EntityRelationItem[] = [];
  for (const r of rows) {
    const outgoing = r.fromEntityId === entityId;
    const otherId = outgoing ? r.toEntityId : r.fromEntityId;
    const other = byId.get(otherId);
    if (!other) continue; // la otra entidad fue borrada
    items.push({ id: r.id, label: r.label, notes: r.notes, other, outgoing });
  }
  return items;
}

async function getAppearancesForEntity(entityId: string): Promise<EntityAppearance[]> {
  return db
    .select({
      pageId: pageEntityMentions.pageId,
      pageTitle: pages.title,
      mentionCount: pageEntityMentions.mentionCount,
    })
    .from(pageEntityMentions)
    .innerJoin(pages, eq(pageEntityMentions.pageId, pages.id))
    .where(and(eq(pageEntityMentions.entityId, entityId), isNull(pages.deletedAt)))
    .orderBy(pages.createdAt);
}

/** Entidades mencionadas en un capítulo — codex rail contextual. */
export async function getMentionedEntities(
  pageId: string,
  userId: string,
): Promise<MentionedEntity[]> {
  const [page] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.userId, userId), isNull(pages.deletedAt)));
  if (!page) return [];

  return db
    .select({
      id: entities.id,
      name: entities.name,
      type: entities.type,
      summary: entities.summary,
      coverImageUrl: entities.coverImageUrl,
      mentionCount: pageEntityMentions.mentionCount,
    })
    .from(pageEntityMentions)
    .innerJoin(entities, eq(pageEntityMentions.entityId, entities.id))
    .where(and(eq(pageEntityMentions.pageId, pageId), isNull(entities.deletedAt)))
    .orderBy(desc(pageEntityMentions.mentionCount), entities.name);
}

// ── escrituras ──

export async function createEntity(
  userId: string,
  input: CreateEntityInput,
): Promise<EntityListItem> {
  await assertSystemOwnership(input.systemId, userId);

  const attrs = parseEntityAttributes(input.type, input.attributes);
  if (!attrs.success) {
    throw new ForbiddenError("Invalid attributes for entity type");
  }

  const [created] = await db
    .insert(entities)
    .values({
      userId,
      systemId: input.systemId,
      type: input.type,
      name: input.name,
      aliases: input.aliases ?? [],
      summary: input.summary ?? null,
      attributes: attrs.data,
      coverImageUrl: input.coverImageUrl ?? null,
      images: input.images ?? [],
    })
    .returning({
      id: entities.id,
      systemId: entities.systemId,
      type: entities.type,
      name: entities.name,
      aliases: entities.aliases,
      summary: entities.summary,
      coverImageUrl: entities.coverImageUrl,
      createdAt: entities.createdAt,
      updatedAt: entities.updatedAt,
    });

  // La entidad nueva puede aparecer ya en capítulos existentes (flujo library o
  // alias de algo ya escrito). Reindexar el universo, best-effort.
  await safeRecomputeSystem(input.systemId, userId);

  return created!;
}

export async function updateEntity(
  entityId: string,
  userId: string,
  input: UpdateEntityInput,
): Promise<EntityListItem | null> {
  const [existing] = await db
    .select({ id: entities.id, type: entities.type, systemId: entities.systemId })
    .from(entities)
    .where(
      and(
        eq(entities.id, entityId),
        eq(entities.userId, userId),
        isNull(entities.deletedAt),
      ),
    );
  if (!existing) return null;

  const nextType = (input.type ?? existing.type) as EntityType;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.type !== undefined) patch.type = input.type;
  if (input.name !== undefined) patch.name = input.name;
  if (input.aliases !== undefined) patch.aliases = input.aliases;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.coverImageUrl !== undefined) patch.coverImageUrl = input.coverImageUrl;
  if (input.images !== undefined) patch.images = input.images;
  // attributes se revalida contra el tipo destino cuando cambia type o attributes.
  if (input.attributes !== undefined || input.type !== undefined) {
    const attrs = parseEntityAttributes(nextType, input.attributes ?? undefined);
    if (!attrs.success) throw new ForbiddenError("Invalid attributes for entity type");
    if (input.attributes !== undefined) patch.attributes = attrs.data;
  }

  const [updated] = await db
    .update(entities)
    .set(patch)
    .where(and(eq(entities.id, entityId), eq(entities.userId, userId)))
    .returning({
      id: entities.id,
      systemId: entities.systemId,
      type: entities.type,
      name: entities.name,
      aliases: entities.aliases,
      summary: entities.summary,
      coverImageUrl: entities.coverImageUrl,
      createdAt: entities.createdAt,
      updatedAt: entities.updatedAt,
    });

  if (!updated) return null;

  // Renombrar o cambiar aliases altera qué capítulos la mencionan: reindexar.
  if (input.name !== undefined || input.aliases !== undefined) {
    await safeRecomputeSystem(existing.systemId, userId);
  }

  return updated;
}

export async function deleteEntity(entityId: string, userId: string): Promise<boolean> {
  const [deleted] = await db
    .update(entities)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(entities.id, entityId),
        eq(entities.userId, userId),
        isNull(entities.deletedAt),
      ),
    )
    .returning({ id: entities.id });
  if (!deleted) return false;

  // Soft-delete no dispara el ON DELETE cascade de la FK, así que las menciones
  // quedarían huérfanas: las limpiamos explícitamente.
  await db.delete(pageEntityMentions).where(eq(pageEntityMentions.entityId, entityId));
  return true;
}

/** Recompute del sistema que nunca propaga su error al llamador (índice derivado). */
async function safeRecomputeSystem(systemId: string, userId: string): Promise<void> {
  try {
    await recomputeSystemMentions(systemId, userId);
  } catch (err) {
    console.error("recomputeSystemMentions failed", { systemId, err });
  }
}

// ── relaciones ──

export async function createRelation(
  fromEntityId: string,
  userId: string,
  input: CreateRelationInput,
): Promise<EntityRelationItem> {
  if (fromEntityId === input.toEntityId) {
    throw new ForbiddenError("An entity cannot relate to itself");
  }

  // Ambas entidades deben ser del usuario y estar vivas.
  const owned = await db
    .select({ id: entities.id, name: entities.name, type: entities.type })
    .from(entities)
    .where(
      and(
        inArray(entities.id, [fromEntityId, input.toEntityId]),
        eq(entities.userId, userId),
        isNull(entities.deletedAt),
      ),
    );
  if (owned.length !== 2) {
    throw new ForbiddenError("Both entities must belong to this user");
  }

  const [created] = await db
    .insert(entityRelations)
    .values({
      fromEntityId,
      toEntityId: input.toEntityId,
      label: input.label ?? null,
      notes: input.notes ?? null,
    })
    .returning({
      id: entityRelations.id,
      label: entityRelations.label,
      notes: entityRelations.notes,
    });

  const other = owned.find((e) => e.id === input.toEntityId)!;
  return {
    id: created!.id,
    label: created!.label,
    notes: created!.notes,
    other,
    outgoing: true,
  };
}

export async function deleteRelation(
  relationId: string,
  userId: string,
): Promise<boolean> {
  // Sólo se borra si la entidad `from` es del usuario.
  const [rel] = await db
    .select({ id: entityRelations.id, fromEntityId: entityRelations.fromEntityId })
    .from(entityRelations)
    .where(eq(entityRelations.id, relationId));
  if (!rel) return false;

  const [owner] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(and(eq(entities.id, rel.fromEntityId), eq(entities.userId, userId)));
  if (!owner) throw new ForbiddenError("Relation does not belong to this user");

  await db.delete(entityRelations).where(eq(entityRelations.id, relationId));
  return true;
}

// ── recompute de menciones (DERIVADA) ──

/**
 * Recalcula `page_entity_mentions` para una page: escanea su texto contra las
 * entidades del universo y reescribe el índice en una transacción. Best-effort —
 * el llamador (page save) no debe romperse si esto falla; se recalcula al
 * siguiente guardado. Sin systemId (page huérfana) no hay universo que escanear.
 */
export async function recomputePageMentions(
  pageId: string,
  systemId: string | null,
  userId: string,
  content: string | null,
): Promise<void> {
  if (!systemId) {
    await db.delete(pageEntityMentions).where(eq(pageEntityMentions.pageId, pageId));
    return;
  }

  const universe = await db
    .select({ id: entities.id, name: entities.name, aliases: entities.aliases })
    .from(entities)
    .where(
      and(
        eq(entities.systemId, systemId),
        eq(entities.userId, userId),
        isNull(entities.deletedAt),
      ),
    );

  const counts = universe.length
    ? detectMentions(plainTextFromHtml(content), universe)
    : new Map<string, number>();

  await db.transaction(async (tx) => {
    await tx.delete(pageEntityMentions).where(eq(pageEntityMentions.pageId, pageId));
    if (counts.size === 0) return;
    await tx.insert(pageEntityMentions).values(
      Array.from(counts.entries()).map(([entityId, mentionCount]) => ({
        pageId,
        entityId,
        mentionCount,
      })),
    );
  });
}

/**
 * Al crear/renombrar una entidad, sus menciones en las páginas existentes del
 * sistema deben reflejarse sin re-guardar cada capítulo. Recalcula todas las
 * páginas del universo. Se llama tras crear/actualizar/borrar entidades.
 */
export async function recomputeSystemMentions(
  systemId: string,
  userId: string,
): Promise<void> {
  const universe = await db
    .select({ id: entities.id, name: entities.name, aliases: entities.aliases })
    .from(entities)
    .where(
      and(
        eq(entities.systemId, systemId),
        eq(entities.userId, userId),
        isNull(entities.deletedAt),
      ),
    );

  const systemPages = await db
    .select({ id: pages.id, content: pages.content })
    .from(pages)
    .where(and(eq(pages.systemId, systemId), eq(pages.userId, userId), isNull(pages.deletedAt)));

  await db.transaction(async (tx) => {
    for (const page of systemPages) {
      const counts = universe.length
        ? detectMentions(plainTextFromHtml(page.content), universe)
        : new Map<string, number>();
      await tx.delete(pageEntityMentions).where(eq(pageEntityMentions.pageId, page.id));
      if (counts.size === 0) continue;
      await tx.insert(pageEntityMentions).values(
        Array.from(counts.entries()).map(([entityId, mentionCount]) => ({
          pageId: page.id,
          entityId,
          mentionCount,
        })),
      );
    }
  });
}
