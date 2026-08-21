"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyCreated,
  applyOptimistic,
  createStickyNoteSpec,
  revertOptimistic,
  type CreateStickyNoteVars,
} from "@/features/offline/offline.mutations";
import { useStampedMutation } from "@/features/offline/offline.hooks";
import type { StickyNoteItem } from "./sticky-notes.types";
import type { UpdateStickyNoteInput, CreateStickyNoteInput } from "./sticky-notes.schemas";
import { stickyNoteKeys } from "./sticky-notes.keys";

// La nota optimista vive ahora en `createStickyNoteSpec` (KIN-57): la cola
// offline tiene que poder redibujarla sin este módulo montado.
export { stickyNoteKeys } from "./sticky-notes.keys";

export function useStickyNotesByPage(pageId: string) {
  return useQuery<StickyNoteItem[]>({
    queryKey: stickyNoteKeys.byPage(pageId),
    enabled: !!pageId,
    queryFn: async () => {
      const res = await fetch(`/api/pages/${pageId}/sticky-notes`);
      if (!res.ok) throw new Error("Failed to fetch sticky notes");
      return res.json();
    },
    refetchOnWindowFocus: true,
  });
}

export function useStickyNotesByFolder(folderId: string) {
  return useQuery<StickyNoteItem[]>({
    queryKey: stickyNoteKeys.byFolder(folderId),
    enabled: !!folderId,
    queryFn: async () => {
      const res = await fetch(`/api/folders/${folderId}/sticky-notes`);
      if (!res.ok) throw new Error("Failed to fetch sticky notes");
      return res.json();
    },
    refetchOnWindowFocus: true,
  });
}

/** Lo que escribe el llamante; el destino (página o carpeta) lo pone el hook. */
type CreateForScope = Omit<CreateStickyNoteInput, "pageId" | "folderId">;

/**
 * Crear sticky note (en una página o en una carpeta). Encolable sin conexión
 * (KIN-57): el destino viaja en las variables, no en el closure, porque la cola
 * tiene que reconstruir la URL después de cerrar el navegador.
 */
function useCreateStickyNote(scope: { pageId: string } | { folderId: string }) {
  const queryClient = useQueryClient();
  // Desarmado en primitivas: el objeto `scope` es nuevo en cada render y como
  // dependencia haría inestables los callbacks de abajo.
  const pageId = "pageId" in scope ? scope.pageId : undefined;
  const folderId = "folderId" in scope ? scope.folderId : undefined;

  const mutation = useMutation<StickyNoteItem, Error, CreateStickyNoteVars>({
    mutationKey: createStickyNoteSpec.mutationKey,
    mutationFn: createStickyNoteSpec.mutationFn,
    networkMode: "offlineFirst",
    onMutate: async (data) => {
      const [queryKey] = createStickyNoteSpec.queryKeys(data);
      await queryClient.cancelQueries({ queryKey });
      applyOptimistic(queryClient, createStickyNoteSpec, data);
    },
    onSuccess: (created, data) =>
      applyCreated(queryClient, createStickyNoteSpec, data, created),
    onError: (_err, data) => revertOptimistic(queryClient, createStickyNoteSpec, data),
    onSettled: (_data, _err, data) => {
      const [queryKey] = createStickyNoteSpec.queryKeys(data);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const stamped = useStampedMutation(mutation);
  const { mutate: stampedMutate, mutateAsync: stampedMutateAsync } = stamped;

  const mutate = useCallback(
    (data: CreateForScope, options?: Parameters<typeof stampedMutate>[1]) =>
      stampedMutate(
        { ...data, ...(pageId ? { pageId } : { folderId: folderId! }) } as CreateStickyNoteVars,
        options,
      ),
    [stampedMutate, pageId, folderId],
  );
  const mutateAsync = useCallback(
    (data: CreateForScope, options?: Parameters<typeof stampedMutateAsync>[1]) =>
      stampedMutateAsync(
        { ...data, ...(pageId ? { pageId } : { folderId: folderId! }) } as CreateStickyNoteVars,
        options,
      ),
    [stampedMutateAsync, pageId, folderId],
  );

  return { ...stamped, mutate, mutateAsync };
}

export function useCreateStickyNoteForPage(pageId: string) {
  return useCreateStickyNote({ pageId });
}

export function useCreateStickyNoteForFolder(folderId: string) {
  return useCreateStickyNote({ folderId });
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

export function useStackStickyNotes(context: { pageId?: string; folderId?: string }) {
  const qc = useQueryClient();
  return useMutation<{ dragged: StickyNoteItem; target: StickyNoteItem }, Error, { draggedId: string; targetId: string }>({
    mutationFn: async ({ draggedId, targetId }) => {
      const res = await fetch("/api/sticky-notes/stack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draggedId, targetId }),
      });
      if (!res.ok) throw new Error("Failed to stack sticky notes");
      return res.json();
    },
    onMutate: async ({ draggedId, targetId }) => {
      const key = context.pageId
        ? stickyNoteKeys.byPage(context.pageId)
        : stickyNoteKeys.byFolder(context.folderId!);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<StickyNoteItem[]>(key);
      qc.setQueryData<StickyNoteItem[]>(key, (old = []) => {
        const target = old.find((n) => n.id === targetId);
        if (!target) return old;
        const stackId = target.stackId ?? target.id;
        return old.map((n) => {
          if (n.id === draggedId) return { ...n, stackId };
          if (n.id === targetId && !target.stackId) return { ...n, stackId };
          return n;
        });
      });
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      const c = ctx as { previous?: StickyNoteItem[]; key?: readonly string[] } | undefined;
      if (c?.previous && c.key) qc.setQueryData(c.key, c.previous);
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
