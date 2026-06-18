import { db } from "@/shared/db";
import { contextTags, systems } from "@/shared/db/schema";
import { and, eq, isNull, or } from "drizzle-orm";
import { NotFoundError } from "@/shared/utils/error";
import type { CreateTagInput, UpdateTagInput } from "./tags.schemas";
import type { ContextTagListItem } from "./tags.types";

const TAG_COLUMNS = {
  id: contextTags.id,
  title: contextTags.title,
  color: contextTags.color,
  systemId: contextTags.systemId,
  isDefault: contextTags.isDefault,
} as const;

/** Tags disponibles en un sistema: los del sistema + los globales del usuario. */
export async function getTagsBySystem(
  systemId: string,
  userId: string,
): Promise<ContextTagListItem[]> {
  return db
    .select(TAG_COLUMNS)
    .from(contextTags)
    .where(
      and(
        eq(contextTags.userId, userId),
        or(eq(contextTags.systemId, systemId), isNull(contextTags.systemId)),
      ),
    )
    .orderBy(contextTags.title);
}

export async function createTag(
  userId: string,
  input: CreateTagInput,
): Promise<ContextTagListItem> {
  if (input.systemId) {
    const [system] = await db
      .select({ id: systems.id })
      .from(systems)
      .where(and(eq(systems.id, input.systemId), eq(systems.userId, userId)));
    if (!system) throw new NotFoundError("System not found");
  }

  const [created] = await db
    .insert(contextTags)
    .values({
      userId,
      systemId: input.systemId ?? null,
      title: input.title,
      color: input.color ?? "blue",
    })
    .returning(TAG_COLUMNS);

  return created!;
}

export async function updateTag(
  tagId: string,
  userId: string,
  data: UpdateTagInput,
): Promise<ContextTagListItem | null> {
  const [updated] = await db
    .update(contextTags)
    .set(data)
    .where(and(eq(contextTags.id, tagId), eq(contextTags.userId, userId)))
    .returning(TAG_COLUMNS);

  return updated ?? null;
}

export async function deleteTag(tagId: string, userId: string): Promise<boolean> {
  // tasks.context_tag_id queda en null por la FK (ON DELETE SET NULL).
  const [deleted] = await db
    .delete(contextTags)
    .where(and(eq(contextTags.id, tagId), eq(contextTags.userId, userId)))
    .returning({ id: contextTags.id });

  return !!deleted;
}
