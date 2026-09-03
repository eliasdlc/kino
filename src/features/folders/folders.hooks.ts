"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { useOptimisticList } from "@/shared/hooks/optimistic";
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
  return useOptimisticList<FolderListItem, Error, Omit<CreateFolderInput, "systemId">, FolderWithCounts>({
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
  return useOptimisticList<
    FolderListItem,
    Error,
    { folderId: string; data: UpdateFolderInput },
    FolderWithCounts
  >({
    mutationFn: ({ folderId, data }) => api.folders.update({ id: folderId, ...data }),
    queryKey: folderKeys.bySystem(systemId),
    updater: (folders, { folderId, data }) =>
      folders.map((f) => (f.id === folderId ? { ...f, ...data } : f)),
  });
}

export function useDeleteFolder(systemId: string) {
  return useOptimisticList<void, Error, string, FolderWithCounts>({
    mutationFn: (folderId) => api.folders.remove({ id: folderId }),
    queryKey: folderKeys.bySystem(systemId),
    updater: (folders, folderId) => folders.filter((f) => f.id !== folderId),
  });
}
