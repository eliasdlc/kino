"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiKeyTtl } from "./api-keys.schemas";
import { api } from "@/shared/api/client";
import { useOptimisticList } from "@/shared/hooks/optimistic";

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  /** null = no caduca. */
  expiresAt: string | null;
  /** null = activa. */
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedApiKey extends ApiKeyRecord {
  token: string;
}

export const apiKeyKeys = {
  all: ["api-keys"] as const,
};

export function useApiKeys() {
  return useQuery<ApiKeyRecord[]>({
    queryKey: apiKeyKeys.all,
    queryFn: async () => {
      return api.apiKeys.list({});
    },
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation<CreatedApiKey, Error, { name: string; ttl: ApiKeyTtl }>({
    mutationFn: async (data) => {
      return api.apiKeys.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: apiKeyKeys.all });
    },
  });
}

export function useDeleteApiKey() {
  return useOptimisticList<void, Error, string, ApiKeyRecord>({
    mutationFn: (id) => api.apiKeys.remove({ id }),
    queryKey: apiKeyKeys.all,
    updater: (keys, id) => keys.filter((k) => k.id !== id),
  });
}

export function useRevokeApiKey() {
  return useOptimisticList<void, Error, string, ApiKeyRecord>({
    mutationFn: (id) => api.apiKeys.revoke({ id }),
    queryKey: apiKeyKeys.all,
    updater: (keys, id) =>
      keys.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)),
  });
}
