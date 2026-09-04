"use client";

import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import type { CreateFolderInput, UpdateFolderInput } from "./folders.schemas";

export function useFolders(systemId: string, options?: { enabled?: boolean }) {
  return useConvexQuery(api.folders.bySystem, { systemId }, options);
}

export function useFolderChildren(folderId: string) {
  return useConvexQuery(api.folders.children, { id: folderId });
}

export function useCreateFolder(systemId: string) {
  return useConvexMutation(api.folders.create, {
    map: (data: Omit<CreateFolderInput, "systemId">) => ({ ...data, systemId }),
  });
}

export function useUpdateFolder(_systemId: string) {
  return useConvexMutation(api.folders.update, {
    map: ({ folderId, data }: { folderId: string; data: UpdateFolderInput }) => ({ id: folderId, ...data }),
  });
}

export function useDeleteFolder(_systemId: string) {
  return useConvexMutation(api.folders.remove, { map: (folderId: string) => ({ id: folderId }) });
}
