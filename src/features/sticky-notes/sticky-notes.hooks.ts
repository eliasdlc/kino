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
import { api } from "@/shared/api/client";
import { useOptimisticList } from "@/shared/hooks/optimistic";
import type { StickyNoteItem } from "./sticky-notes.types";
import type { UpdateStickyNoteInput, CreateStickyNoteInput } from "./sticky-notes.schemas";
import { stickyNoteKeys } from "./sticky-notes.keys";

// La nota optimista vive ahora en `createStickyNoteSpec` (KIN-57): la cola
// offline tiene que poder redibujarla sin este módulo montado.
export { stickyNoteKeys } from "./sticky-notes.keys";

export function useStickyNotesByPage(pageId: string) {
  return useQuery({
    queryKey: stickyNoteKeys.byPage(pageId),
    enabled: !!pageId,
    queryFn: () => api.stickyNotes.byPage({ pageId }),
    refetchOnWindowFocus: true,
  });
}

export function useStickyNotesByFolder(folderId: string) {
  return useQuery({
    queryKey: stickyNoteKeys.byFolder(folderId),
    enabled: !!folderId,
    queryFn: () => api.stickyNotes.byFolder({ folderId }),
    refetchOnWindowFocus: true,
  });
}

/** Una nota cuelga de una página o de una carpeta, nunca de las dos. */
type StickyScope = { pageId?: string; folderId?: string };

function scopeKey(scope: StickyScope) {
  return scope.pageId
    ? stickyNoteKeys.byPage(scope.pageId)
    : stickyNoteKeys.byFolder(scope.folderId!);
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

export function useUpdateStickyNote(scope: StickyScope) {
  return useOptimisticList<
    StickyNoteItem,
    Error,
    { noteId: string; data: UpdateStickyNoteInput },
    StickyNoteItem
  >({
    mutationFn: ({ noteId, data }) => api.stickyNotes.update({ id: noteId, ...data }),
    queryKey: scopeKey(scope),
    updater: (notes, { noteId, data }) =>
      notes.map((n) => (n.id === noteId ? { ...n, ...data } : n)),
  });
}

export function useStackStickyNotes(scope: StickyScope) {
  return useOptimisticList<
    { dragged: StickyNoteItem; target: StickyNoteItem },
    Error,
    { draggedId: string; targetId: string },
    StickyNoteItem
  >({
    mutationFn: ({ draggedId, targetId }) => api.stickyNotes.stack({ draggedId, targetId }),
    queryKey: scopeKey(scope),
    updater: (notes, { draggedId, targetId }) => {
      const target = notes.find((n) => n.id === targetId);
      if (!target) return notes;
      // La pila la nombra la nota que recibe; si no tenía, se estrena con la suya.
      const stackId = target.stackId ?? target.id;
      return notes.map((n) =>
        n.id === draggedId || (n.id === targetId && !target.stackId) ? { ...n, stackId } : n,
      );
    },
  });
}

export function useDeleteStickyNote(scope: StickyScope) {
  return useOptimisticList<void, Error, string, StickyNoteItem>({
    mutationFn: (noteId) => api.stickyNotes.remove({ id: noteId }),
    queryKey: scopeKey(scope),
    updater: (notes, noteId) => notes.filter((n) => n.id !== noteId),
  });
}
