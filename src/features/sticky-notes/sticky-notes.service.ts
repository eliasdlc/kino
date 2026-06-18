import { db } from "@/shared/db";
import { stickyNotes } from "@/shared/db/schema";
import { and, eq } from "drizzle-orm";
import type { CreateStickyNoteInput, UpdateStickyNoteInput } from "./sticky-notes.schemas";
import type { StickyNoteItem } from "./sticky-notes.types";

const NOTE_COLUMNS = {
  id: stickyNotes.id,
  title: stickyNotes.title,
  content: stickyNotes.content,
  color: stickyNotes.color,
  sortIndex: stickyNotes.sortIndex,
  pageId: stickyNotes.pageId,
  folderId: stickyNotes.folderId,
  positionSide: stickyNotes.positionSide,
  positionY: stickyNotes.positionY,
  positionX: stickyNotes.positionX,
  anchorId: stickyNotes.anchorId,
  stackId: stickyNotes.stackId,
  textAnchor: stickyNotes.textAnchor,
} as const;

export async function getStickyNotesByPage(
  pageId: string,
  userId: string
): Promise<StickyNoteItem[]> {
  return db
    .select(NOTE_COLUMNS)
    .from(stickyNotes)
    .where(and(eq(stickyNotes.pageId, pageId), eq(stickyNotes.userId, userId)))
    .orderBy(stickyNotes.sortIndex);
}

export async function getStickyNotesByFolder(
  folderId: string,
  userId: string
): Promise<StickyNoteItem[]> {
  return db
    .select(NOTE_COLUMNS)
    .from(stickyNotes)
    .where(and(eq(stickyNotes.folderId, folderId), eq(stickyNotes.userId, userId)))
    .orderBy(stickyNotes.sortIndex);
}

export async function createStickyNote(
  userId: string,
  input: CreateStickyNoteInput & ({ pageId: string } | { folderId: string })
): Promise<StickyNoteItem> {
  const [created] = await db
    .insert(stickyNotes)
    .values({
      userId,
      title: input.title ?? null,
      content: input.content ?? null,
      color: input.color ?? "yellow",
      textAnchor: input.textAnchor ?? null,
      positionSide: input.positionSide ?? null,
      positionY: input.positionY ?? null,
      positionX: input.positionX ?? null,
      anchorId: input.anchorId ?? null,
      pageId: "pageId" in input ? input.pageId : null,
      folderId: "folderId" in input ? input.folderId : null,
    })
    .returning(NOTE_COLUMNS);

  return created!;
}

export async function updateStickyNote(
  noteId: string,
  userId: string,
  data: UpdateStickyNoteInput
): Promise<StickyNoteItem | null> {
  const [updated] = await db
    .update(stickyNotes)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(stickyNotes.id, noteId), eq(stickyNotes.userId, userId)))
    .returning(NOTE_COLUMNS);

  return updated ?? null;
}

export async function deleteStickyNote(
  noteId: string,
  userId: string
): Promise<boolean> {
  const [deleted] = await db
    .delete(stickyNotes)
    .where(and(eq(stickyNotes.id, noteId), eq(stickyNotes.userId, userId)))
    .returning({ id: stickyNotes.id });

  return !!deleted;
}
