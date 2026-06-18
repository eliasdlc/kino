"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PageListItem, PageDetail, LinkedTask, PageMutationResult } from "./pages.types";
import type { CreatePageInput, UpdatePageInput } from "./pages.schemas";
import type { ContextTagListItem } from "@/features/tags/tags.types";

export const pageKeys = {
  bySystem: (systemId: string) => ["pages", "system", systemId] as const,
  detail: (pageId: string) => ["pages", "detail", pageId] as const,
  linkedTasks: (pageId: string) => ["pages", "tasks", pageId] as const,
  tags: (pageId: string) => ["pages", "tags", pageId] as const,
  subPages: (pageId: string) => ["pages", "subpages", pageId] as const,
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

  return useMutation<PageMutationResult, Error, UpdatePageInput>({
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

export function usePageTags(pageId: string) {
  return useQuery<ContextTagListItem[]>({
    queryKey: pageKeys.tags(pageId),
    queryFn: async () => {
      const res = await fetch(`/api/pages/${pageId}/tags`);
      if (!res.ok) throw new Error("Failed to fetch page tags");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useAddPageTag(pageId: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (tagId) => {
      const res = await fetch(`/api/pages/${pageId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      if (!res.ok) throw new Error("Failed to add tag");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pageKeys.tags(pageId) });
      qc.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
    },
  });
}

export function useSubPages(parentPageId: string) {
  return useQuery<PageListItem[]>({
    queryKey: pageKeys.subPages(parentPageId),
    queryFn: async () => {
      const res = await fetch(`/api/pages/${parentPageId}/subpages`);
      if (!res.ok) throw new Error("Failed to fetch sub-pages");
      return res.json();
    },
    staleTime: 10_000,
  });
}

export function useCreateSubPage(parentPageId: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation<PageListItem, Error, { title?: string }>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/pages/${parentPageId}/subpages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemId }),
      });
      if (!res.ok) throw new Error("Failed to create sub-page");
      const page = await res.json() as PageListItem;
      if (data.title) {
        await fetch(`/api/pages/${page.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: data.title }),
        });
      }
      return page;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pageKeys.subPages(parentPageId) });
      qc.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
    },
  });
}

export function useRemovePageTag(pageId: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (tagId) => {
      const res = await fetch(`/api/pages/${pageId}/tags/${tagId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove tag");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pageKeys.tags(pageId) });
      qc.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
    },
  });
}
