"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { useOptimisticListMutation } from "@/shared/hooks/useOptimisticListMutation";
import type { CreateFolderInput, UpdateFolderInput } from "./folders.schemas";
import type { FolderListItem, FolderWithCounts } from "./folders.types";

export const folderKeys = {
  bySystem: (systemId: string) => ["folders", systemId] as const,
  children: (folderId: string) => ["folders", "children", folderId] as const,
};

export function useFolders(systemId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: folderKeys.bySystem(systemId),
    queryFn: () => api.folders.bySystem({ systemId }),
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: true,
  });
}

export function useFolderChildren(folderId: string) {
  return useQuery<FolderWithCounts[]>({
    queryKey: folderKeys.children(folderId),
    queryFn: async () => {
      return api.folders.children({ id: folderId });
    },
    refetchOnWindowFocus: true,
  });
}

export function useCreateFolder(systemId: string) {
  return useOptimisticListMutation<FolderListItem, Error, Omit<CreateFolderInput, "systemId">, FolderWithCounts>({
    mutationFn: (data) => api.folders.create({ ...data, systemId }),
    queryKey: folderKeys.bySystem(systemId),
    updater: (folders, data) => [
      ...folders,
      {
        id: crypto.randomUUID(),
        name: data.name,
        color: data.color ?? "blue",
        sortIndex: 0,
        parentId: data.parentId ?? null,
        systemId,
        metadata: data.metadata ?? null,
        subfolderCount: 0,
        pageCount: 0,
      },
    ],
  });
}

export function useUpdateFolder(systemId: string) {
  const qc = useQueryClient();

  return useMutation<FolderListItem, Error, { folderId: string; data: UpdateFolderInput }>({
    mutationFn: async ({ folderId, data }) => {
      return api.folders.update({ id: folderId, ...data });
    },
    onMutate: async ({ folderId, data }) => {
      await qc.cancelQueries({ queryKey: folderKeys.bySystem(systemId) });
      const previous = qc.getQueryData<FolderWithCounts[]>(folderKeys.bySystem(systemId));
      qc.setQueryData<FolderWithCounts[]>(folderKeys.bySystem(systemId), (old = []) =>
        old.map((f) => (f.id === folderId ? { ...f, ...data } : f))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: FolderWithCounts[] } | undefined;
      if (ctx?.previous) qc.setQueryData(folderKeys.bySystem(systemId), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: folderKeys.bySystem(systemId) });
    },
  });
}

export function useDeleteFolder(systemId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (folderId) => api.folders.remove({ id: folderId }),
    onMutate: async (folderId) => {
      await qc.cancelQueries({ queryKey: folderKeys.bySystem(systemId) });
      const previous = qc.getQueryData<FolderWithCounts[]>(folderKeys.bySystem(systemId));
      qc.setQueryData<FolderWithCounts[]>(folderKeys.bySystem(systemId), (old = []) =>
        old.filter((f) => f.id !== folderId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: FolderWithCounts[] } | undefined;
      if (ctx?.previous) qc.setQueryData(folderKeys.bySystem(systemId), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: folderKeys.bySystem(systemId) });
    },
  });
}
