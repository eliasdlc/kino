"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StickyNoteItem } from "./sticky-notes.types";
import type { UpdateStickyNoteInput, CreateStickyNoteInput } from "./sticky-notes.schemas";

export const stickyNoteKeys = {
  byPage: (pageId: string) => ["sticky-notes", "page", pageId] as const,
  byFolder: (folderId: string) => ["sticky-notes", "folder", folderId] as const,
};

export function useStickyNotesByPage(pageId: string) {
  return useQuery<StickyNoteItem[]>({
    queryKey: stickyNoteKeys.byPage(pageId),
    queryFn: async () => {
      const res = await fetch(`/api/pages/${pageId}/sticky-notes`);
      if (!res.ok) throw new Error("Failed to fetch sticky notes");
      return res.json();
    },
  });
}

export function useStickyNotesByFolder(folderId: string) {
  return useQuery<StickyNoteItem[]>({
    queryKey: stickyNoteKeys.byFolder(folderId),
    queryFn: async () => {
      const res = await fetch(`/api/folders/${folderId}/sticky-notes`);
      if (!res.ok) throw new Error("Failed to fetch sticky notes");
      return res.json();
    },
  });
}

type CreateForPage = Omit<CreateStickyNoteInput, "pageId" | "folderId">;
type CreateForFolder = Omit<CreateStickyNoteInput, "pageId" | "folderId">;

export function useCreateStickyNoteForPage(pageId: string) {
  const qc = useQueryClient();
  return useMutation<StickyNoteItem, Error, CreateForPage>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/pages/${pageId}/sticky-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create sticky note");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stickyNoteKeys.byPage(pageId) });
    },
  });
}

export function useCreateStickyNoteForFolder(folderId: string) {
  const qc = useQueryClient();
  return useMutation<StickyNoteItem, Error, CreateForFolder>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/folders/${folderId}/sticky-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create sticky note");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stickyNoteKeys.byFolder(folderId) });
    },
  });
}

export function useUpdateStickyNote(context: { pageId?: string; folderId?: string }) {
  const qc = useQueryClient();
  return useMutation<StickyNoteItem, Error, { noteId: string; data: UpdateStickyNoteInput }>({
    mutationFn: async ({ noteId, data }) => {
      const res = await fetch(`/api/sticky-notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update sticky note");
      return res.json();
    },
    onMutate: async ({ noteId, data }) => {
      const key = context.pageId
        ? stickyNoteKeys.byPage(context.pageId)
        : stickyNoteKeys.byFolder(context.folderId!);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<StickyNoteItem[]>(key);
      qc.setQueryData<StickyNoteItem[]>(key, (old = []) =>
        old.map((n) => (n.id === noteId ? { ...n, ...data } : n))
      );
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: StickyNoteItem[]; key?: readonly string[] } | undefined;
      if (ctx?.previous && ctx.key) {
        qc.setQueryData(ctx.key, ctx.previous);
      }
    },
    onSettled: () => {
      if (context.pageId) qc.invalidateQueries({ queryKey: stickyNoteKeys.byPage(context.pageId) });
      if (context.folderId) qc.invalidateQueries({ queryKey: stickyNoteKeys.byFolder(context.folderId) });
    },
  });
}

export function useDeleteStickyNote(context: { pageId?: string; folderId?: string }) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (noteId) => {
      const res = await fetch(`/api/sticky-notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete sticky note");
    },
    onMutate: async (noteId) => {
      const key = context.pageId
        ? stickyNoteKeys.byPage(context.pageId)
        : stickyNoteKeys.byFolder(context.folderId!);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<StickyNoteItem[]>(key);
      qc.setQueryData<StickyNoteItem[]>(key, (old = []) =>
        old.filter((n) => n.id !== noteId)
      );
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: StickyNoteItem[]; key?: readonly string[] } | undefined;
      if (ctx?.previous && ctx.key) {
        qc.setQueryData(ctx.key, ctx.previous);
      }
    },
    onSettled: () => {
      if (context.pageId) qc.invalidateQueries({ queryKey: stickyNoteKeys.byPage(context.pageId) });
      if (context.folderId) qc.invalidateQueries({ queryKey: stickyNoteKeys.byFolder(context.folderId) });
    },
  });
}
