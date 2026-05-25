"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PageListItem, PageDetail, LinkedTask } from "./pages.types";
import type { CreatePageInput, UpdatePageInput } from "./pages.schemas";

export const pageKeys = {
  bySystem: (systemId: string) => ["pages", "system", systemId] as const,
  detail: (pageId: string) => ["pages", "detail", pageId] as const,
  linkedTasks: (pageId: string) => ["pages", "tasks", pageId] as const,
};

export function usePages(systemId: string) {
  return useQuery<PageListItem[]>({
    queryKey: pageKeys.bySystem(systemId),
    queryFn: async () => {
      const res = await fetch(`/api/systems/${systemId}/pages`);
      if (!res.ok) throw new Error("Failed to fetch pages");
      return res.json();
    },
    refetchInterval: 5_000,
  });
}

export function usePage(pageId: string) {
  return useQuery<PageDetail>({
    queryKey: pageKeys.detail(pageId),
    queryFn: async () => {
      const res = await fetch(`/api/pages/${pageId}`);
      if (!res.ok) throw new Error("Failed to fetch page");
      return res.json();
    },
    refetchInterval: 5_000,
  });
}

export function useLinkedTasks(pageId: string) {
  return useQuery<LinkedTask[]>({
    queryKey: pageKeys.linkedTasks(pageId),
    queryFn: async () => {
      const res = await fetch(`/api/pages/${pageId}/tasks`);
      if (!res.ok) throw new Error("Failed to fetch linked tasks");
      return res.json();
    },
    refetchInterval: 5_000,
  });
}

export function useCreatePage(systemId: string) {
  const qc = useQueryClient();

  return useMutation<PageListItem, Error, Omit<CreatePageInput, "systemId">>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/systems/${systemId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to create page");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
    },
  });
}

export function useUpdatePage(pageId: string, systemId?: string) {
  const qc = useQueryClient();

  return useMutation<PageListItem, Error, UpdatePageInput>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Failed to update page");
      }
      return res.json();
    },
    onSuccess: (updated) => {
      qc.setQueryData<PageDetail>(pageKeys.detail(pageId), (old) =>
        old ? { ...old, ...updated } : undefined
      );
      if (systemId) {
        qc.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
      }
    },
  });
}

export function useDeletePage(systemId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (pageId) => {
      const res = await fetch(`/api/pages/${pageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete page");
    },
    onSuccess: (_, pageId) => {
      qc.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
      qc.invalidateQueries({ queryKey: pageKeys.linkedTasks(pageId) });
      qc.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
    },
  });
}

export function useLinkTask(pageId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (taskId) => {
      const res = await fetch(`/api/pages/${pageId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) throw new Error("Failed to link task");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pageKeys.linkedTasks(pageId) });
      qc.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
    },
  });
}

export function useUnlinkTask(pageId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (taskId) => {
      const res = await fetch(`/api/pages/${pageId}/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to unlink task");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pageKeys.linkedTasks(pageId) });
      qc.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
    },
  });
}
