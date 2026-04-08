"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateFolderInput } from "./folders.schemas";
import type { FolderListItem } from "./folders.types";

export const folderKeys = {
  bySystem: (systemId: string) => ["folders", systemId] as const,
};

export function useFolders(
  systemId: string,
  options?: { enabled?: boolean }
) {
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

export function useCreateFolder(systemId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<CreateFolderInput, "systemId">
    ): Promise<FolderListItem> => {
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
