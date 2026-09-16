"use client";

import { api } from "@convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import type { OptimisticLocalStore } from "convex/browser";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import type { UpdateStickyNoteInput, CreateStickyNoteInput } from "./sticky-notes.schemas";
import type { StickyNoteItem } from "./sticky-notes.types";

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

type UpdateArgs = FunctionArgs<typeof api.stickyNotes.update>;

/**
 * La nota tal y como la devolverá el servidor tras el parche: un campo que
 * llega `null` se borra, uno que no llega se queda. Es el espejo de `update`
 * en `convex/stickyNotes.ts`.
 */
function applyPatch(note: StickyNoteItem, { id: _id, ...patch }: UpdateArgs): StickyNoteItem {
  const next = { ...note };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    (next as Record<string, unknown>)[key] = value;
  }
  return next;
}

/**
 * Reescribe la lista de notas de la página o de la carpeta antes de que el
 * servidor conteste. Sin esto, soltar una nota la devolvía a su sitio viejo
 * durante el viaje de ida y vuelta y luego saltaba al nuevo.
 */
function patchNoteLocally(scope: StickyScope, store: OptimisticLocalStore, args: UpdateArgs) {
  if (scope.pageId) {
    const query = { pageId: scope.pageId as never };
    const notes = store.getQuery(api.stickyNotes.byPage, query);
    if (notes) store.setQuery(api.stickyNotes.byPage, query, notes.map((n) => (n.id === args.id ? applyPatch(n, args) : n)));
  }
  if (scope.folderId) {
    const query = { folderId: scope.folderId as never };
    const notes = store.getQuery(api.stickyNotes.byFolder, query);
    if (notes) store.setQuery(api.stickyNotes.byFolder, query, notes.map((n) => (n.id === args.id ? applyPatch(n, args) : n)));
  }
}

export function useUpdateStickyNote(scope: StickyScope) {
  return useConvexMutation(api.stickyNotes.update, {
    map: ({ noteId, data }: { noteId: string; data: UpdateStickyNoteInput }) => ({ id: noteId, ...data }),
    optimisticUpdate: (store, args) => patchNoteLocally(scope, store, args),
  });
}

export function useStackStickyNotes(_scope: StickyScope) {
  return useConvexMutation(api.stickyNotes.stack);
}

export function useDeleteStickyNote(_scope: StickyScope) {
  return useConvexMutation(api.stickyNotes.remove, { map: (noteId: string) => ({ id: noteId }) });
}
