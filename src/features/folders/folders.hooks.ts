"use client";

import { useAcademicScope } from "@/features/academic/academic-scope";
import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import type { CreateFolderInput, UpdateFolderInput } from "./folders.schemas";

export function useFolders(systemId: string, options?: { enabled?: boolean }) {
  const scope = useAcademicScope(systemId);
  return useConvexQuery(api.folders.bySystem, { systemId, ...(scope?.academicPeriodId !== undefined ? { academicPeriodId: scope.academicPeriodId } : {}) }, options);
}

export function useFolderChildren(folderId: string) {
  return useConvexQuery(api.folders.children, { id: folderId });
}

export function useCreateFolder(systemId: string) {
  const scope = useAcademicScope(systemId);
  return useConvexMutation(api.folders.create, {
    map: (data: Omit<CreateFolderInput, "systemId">) => ({ ...data, systemId, ...(scope?.academicPeriodId && !data.parentId ? { academicPeriodId: scope.academicPeriodId } : {}) }),
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
