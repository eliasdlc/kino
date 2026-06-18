"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateTagInput, UpdateTagInput } from "./tags.schemas";
import type { ContextTagListItem } from "./tags.types";

export const tagKeys = {
  bySystem: (systemId: string) => ["tags", systemId] as const,
};

export function useTags(systemId: string) {
  return useQuery<ContextTagListItem[]>({
    queryKey: tagKeys.bySystem(systemId),
    queryFn: async () => {
      const res = await fetch(`/api/systems/${systemId}/tags`);
      if (!res.ok) throw new Error("Failed to fetch tags");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useCreateTag(systemId: string) {
  const qc = useQueryClient();
  return useMutation<ContextTagListItem, Error, Omit<CreateTagInput, "systemId">>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/systems/${systemId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Failed to create tag");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.bySystem(systemId) }),
  });
}

export function useUpdateTag(systemId: string) {
  const qc = useQueryClient();
  return useMutation<ContextTagListItem, Error, { tagId: string; data: UpdateTagInput }>({
    mutationFn: async ({ tagId, data }) => {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update tag");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.bySystem(systemId) }),
  });
}

export function useDeleteTag(systemId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (tagId) => {
      const res = await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete tag");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.bySystem(systemId) }),
  });
}
