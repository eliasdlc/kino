"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiKeyTtl } from "./api-keys.schemas";
import { api } from "@/shared/api/client";

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
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.apiKeys.remove({ id });
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: apiKeyKeys.all });
      const previous = qc.getQueryData<ApiKeyRecord[]>(apiKeyKeys.all);
      qc.setQueryData<ApiKeyRecord[]>(apiKeyKeys.all, (old = []) =>
        old.filter((k) => k.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      const ctx = context as { previous?: ApiKeyRecord[] } | undefined;
      if (ctx?.previous) qc.setQueryData(apiKeyKeys.all, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: apiKeyKeys.all });
    },
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation<void, Error, string, { previous?: ApiKeyRecord[] }>({
    mutationFn: async (id) => {
      await api.apiKeys.revoke({ id });
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: apiKeyKeys.all });
      const previous = qc.getQueryData<ApiKeyRecord[]>(apiKeyKeys.all);
      const now = new Date().toISOString();
      qc.setQueryData<ApiKeyRecord[]>(apiKeyKeys.all, (old = []) =>
        old.map((k) => (k.id === id ? { ...k, revokedAt: now } : k))
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) qc.setQueryData(apiKeyKeys.all, context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: apiKeyKeys.all });
    },
  });
}
