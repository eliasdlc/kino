"use client";

import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import type { UpdateStickyNoteInput, CreateStickyNoteInput } from "./sticky-notes.schemas";

export function useStickyNotesByPage(pageId: string) {
  return useConvexQuery(api.stickyNotes.byPage, { pageId }, { enabled: !!pageId });
}

export function useStickyNotesByFolder(folderId: string) {
  return useConvexQuery(api.stickyNotes.byFolder, { folderId }, { enabled: !!folderId });
}

/** Una nota cuelga de una página o de una carpeta, nunca de las dos. */
type StickyScope = { pageId?: string; folderId?: string };

/** Lo que escribe el llamante; el destino (página o carpeta) lo pone el hook. */
type CreateForScope = Omit<CreateStickyNoteInput, "pageId" | "folderId">;

export function useCreateStickyNoteForPage(pageId: string) {
  return useConvexMutation(api.stickyNotes.createOnPage, {
    map: (data: CreateForScope) => ({ ...data, pageId }),
  });
}

export function useCreateStickyNoteForFolder(folderId: string) {
  return useConvexMutation(api.stickyNotes.createOnFolder, {
    map: (data: CreateForScope) => ({ ...data, folderId }),
  });
}

export function useUpdateStickyNote(_scope: StickyScope) {
  return useConvexMutation(api.stickyNotes.update, {
    map: ({ noteId, data }: { noteId: string; data: UpdateStickyNoteInput }) => ({ id: noteId, ...data }),
  });
}

export function useStackStickyNotes(_scope: StickyScope) {
  return useConvexMutation(api.stickyNotes.stack);
}

export function useDeleteStickyNote(_scope: StickyScope) {
  return useConvexMutation(api.stickyNotes.remove, { map: (noteId: string) => ({ id: noteId }) });
}
