"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiKeyTtl } from "./api-keys.schemas";

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
      const res = await fetch("/api/api-keys");
      if (!res.ok) throw new Error("Failed to fetch API keys");
      return res.json();
    },
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation<CreatedApiKey, Error, { name: string; ttl: ApiKeyTtl }>({
    mutationFn: async (data) => {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create API key");
      return res.json();
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
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete API key");
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
      const res = await fetch(`/api/api-keys/${id}/revoke`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to revoke API key");
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
