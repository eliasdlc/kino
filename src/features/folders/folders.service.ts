import { db } from "@/shared/db";
import { folders } from "@/shared/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { CreateFolderInput, UpdateFolderInput } from "./folders.schemas";
import type { BreadcrumbItem, FolderDetail, FolderListItem } from "./folders.types";

const FOLDER_LIST_COLUMNS = {
  id: folders.id,
  name: folders.name,
  color: folders.color,
  sortIndex: folders.sortIndex,
  parentId: folders.parentId,
  systemId: folders.systemId,
} as const;

export async function getFoldersBySystem(
  systemId: string,
  userId: string
): Promise<FolderListItem[]> {
  return db
    .select(FOLDER_LIST_COLUMNS)
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

export async function getFolderById(
  folderId: string,
  userId: string
): Promise<FolderDetail | null> {
  const [folder] = await db
    .select({
      id: folders.id,
      name: folders.name,
      color: folders.color,
      sortIndex: folders.sortIndex,
      parentId: folders.parentId,
      systemId: folders.systemId,
      path: folders.path,
    })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)));

  return folder ?? null;
}

export async function getFolderChildren(
  folderId: string,
  userId: string
): Promise<FolderListItem[]> {
  return db
    .select(FOLDER_LIST_COLUMNS)
    .from(folders)
    .where(and(eq(folders.parentId, folderId), eq(folders.userId, userId)))
    .orderBy(folders.sortIndex);
}

export async function getFolderBreadcrumb(
  folderPath: string,
  userId: string
): Promise<BreadcrumbItem[]> {
  // Gets all ancestors (not including the folder itself), ordered root → parent.
  // Uses raw SQL because Drizzle doesn't support ltree @> operator natively.
  const rows = await db.execute<{ id: string; name: string; path: string }>(
    sql`
      SELECT id, name, path::text
      FROM folders
      WHERE user_id = ${userId}
        AND path @> ${folderPath}::ltree
        AND path::text != ${folderPath}
      ORDER BY nlevel(path) ASC
    `
  );
  // postgres.js driver returns rows directly as an array (RowList extends Array)
  return Array.from(rows) as BreadcrumbItem[];
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
    .returning(FOLDER_LIST_COLUMNS);

  return created!;
}

export async function updateFolder(
  folderId: string,
  userId: string,
  data: UpdateFolderInput
): Promise<FolderListItem | null> {
  const [updated] = await db
    .update(folders)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .returning(FOLDER_LIST_COLUMNS);

  return updated ?? null;
}

export async function deleteFolder(
  folderId: string,
  userId: string
): Promise<boolean> {
  const [deleted] = await db
    .delete(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .returning({ id: folders.id });

  return !!deleted;
}
