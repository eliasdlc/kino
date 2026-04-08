import { db } from "@/shared/db";
import { folders } from "@/shared/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { CreateFolderInput } from "./folders.schemas";
import type { FolderListItem } from "./folders.types";

export async function getFoldersBySystem(
  systemId: string,
  userId: string
): Promise<FolderListItem[]> {
  return db
    .select({
      id: folders.id,
      name: folders.name,
      color: folders.color,
      sortIndex: folders.sortIndex,
      parentId: folders.parentId,
      systemId: folders.systemId,
    })
    .from(folders)
    .where(
      and(
        eq(folders.systemId, systemId),
        eq(folders.userId, userId),
        isNull(folders.parentId)
      )
    )
    .orderBy(folders.sortIndex);
}

export async function createFolder(
  userId: string,
  input: CreateFolderInput
): Promise<FolderListItem> {
  const id = crypto.randomUUID();
  const safePath = id.replaceAll("-", "_");

  let path = safePath;
  if (input.parentId) {
    const [parent] = await db
      .select({ path: folders.path })
      .from(folders)
      .where(and(eq(folders.id, input.parentId), eq(folders.userId, userId)));
    if (!parent) throw new Error("Parent folder not found");
    path = `${parent.path}.${safePath}`;
  }

  const [created] = await db
    .insert(folders)
    .values({
      id,
      userId,
      systemId: input.systemId,
      parentId: input.parentId ?? null,
      name: input.name,
      color: input.color ?? "blue",
      path,
    })
    .returning({
      id: folders.id,
      name: folders.name,
      color: folders.color,
      sortIndex: folders.sortIndex,
      parentId: folders.parentId,
      systemId: folders.systemId,
    });

  return created;
}
