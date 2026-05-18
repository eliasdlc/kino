"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateFolderInput, UpdateFolderInput } from "./folders.schemas";
import type { FolderListItem } from "./folders.types";

export const folderKeys = {
  bySystem: (systemId: string) => ["folders", systemId] as const,
  children: (folderId: string) => ["folders", "children", folderId] as const,
};

export function useFolders(systemId: string, options?: { enabled?: boolean }) {
  return useQuery<FolderListItem[]>({
    queryKey: folderKeys.bySystem(systemId),
    queryFn: async () => {
      const res = await fetch(`/api/systems/${systemId}/folders`);
      if (!res.ok) throw new Error("Failed to fetch folders");
      return res.json();
    },
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useFolderChildren(folderId: string, systemId: string) {
  const qc = useQueryClient();
  return useQuery<FolderListItem[]>({
    queryKey: folderKeys.children(folderId),
    queryFn: async () => {
      // Children come from the system folders list — filter client-side
      // to avoid an extra API route for a simple parentId filter
      const cached = qc.getQueryData<FolderListItem[]>(folderKeys.bySystem(systemId));
      if (cached) return cached.filter((f) => f.parentId === folderId);

      const res = await fetch(`/api/systems/${systemId}/folders`);
      if (!res.ok) throw new Error("Failed to fetch folders");
      const all: FolderListItem[] = await res.json();
      return all.filter((f) => f.parentId === folderId);
    },
    staleTime: 30_000,
  });
}

export function useCreateFolder(systemId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<CreateFolderInput, "systemId">): Promise<FolderListItem> => {
      const res = await fetch(`/api/systems/${systemId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Failed to create folder");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: folderKeys.bySystem(systemId) });
    },
  });
}

export function useUpdateFolder(systemId: string) {
  const qc = useQueryClient();

  return useMutation<FolderListItem, Error, { folderId: string; data: UpdateFolderInput }>({
    mutationFn: async ({ folderId, data }) => {
      const res = await fetch(`/api/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Failed to update folder");
      }
      return res.json();
    },
    onMutate: async ({ folderId, data }) => {
      await qc.cancelQueries({ queryKey: folderKeys.bySystem(systemId) });
      const previous = qc.getQueryData<FolderListItem[]>(folderKeys.bySystem(systemId));
      qc.setQueryData<FolderListItem[]>(folderKeys.bySystem(systemId), (old = []) =>
        old.map((f) => (f.id === folderId ? { ...f, ...data } : f))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: FolderListItem[] } | undefined;
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
    mutationFn: async (folderId) => {
      const res = await fetch(`/api/folders/${folderId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete folder");
    },
    onMutate: async (folderId) => {
      await qc.cancelQueries({ queryKey: folderKeys.bySystem(systemId) });
      const previous = qc.getQueryData<FolderListItem[]>(folderKeys.bySystem(systemId));
      qc.setQueryData<FolderListItem[]>(folderKeys.bySystem(systemId), (old = []) =>
        old.filter((f) => f.id !== folderId)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { previous?: FolderListItem[] } | undefined;
      if (ctx?.previous) qc.setQueryData(folderKeys.bySystem(systemId), ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: folderKeys.bySystem(systemId) });
    },
  });
}
