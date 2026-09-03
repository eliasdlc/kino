"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import type { CreateTagInput, UpdateTagInput } from "./tags.schemas";

export const tagKeys = {
  bySystem: (systemId: string) => ["tags", systemId] as const,
};

export function useTags(systemId: string) {
  return useQuery({
    queryKey: tagKeys.bySystem(systemId),
    queryFn: () => api.tags.bySystem({ systemId }),
    staleTime: 60_000,
  });
}

export function useCreateTag(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CreateTagInput, "systemId">) =>
      api.tags.create({ ...data, systemId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.bySystem(systemId) }),
  });
}

export function useUpdateTag(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tagId, data }: { tagId: string; data: UpdateTagInput }) =>
      api.tags.update({ id: tagId, ...data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.bySystem(systemId) }),
  });
}

export function useDeleteTag(systemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => api.tags.remove({ id: tagId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.bySystem(systemId) }),
  });
}
