"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimisticListMutation } from "@/shared/hooks/useOptimisticListMutation";
import {
  applyCreated,
  applyOptimistic,
  createPageSpec,
  revertOptimistic,
} from "@/features/offline/offline.mutations";
import { useStampedMutation } from "@/features/offline/offline.hooks";
import { pageKeys } from "./pages.keys";
import type { PageListItem, PageDetail, LinkedTask, PageMutationResult } from "./pages.types";
import type { CreatePageInput, UpdatePageInput } from "./pages.schemas";
import type { ContextTagListItem } from "@/features/tags/tags.types";

// El placeholder optimista vive ahora en `createPageSpec` (KIN-57): la cola
// offline tiene que poder redibujarlo sin este módulo montado.
export { pageKeys } from "./pages.keys";

export function usePages(systemId: string) {
  return useQuery<PageListItem[]>({
    queryKey: pageKeys.bySystem(systemId),
    queryFn: async () => {
      const res = await fetch(`/api/systems/${systemId}/pages`);
      if (!res.ok) throw new Error("Failed to fetch pages");
      return res.json();
    },
    refetchOnWindowFocus: true,
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
    refetchOnWindowFocus: true,
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
    refetchOnWindowFocus: true,
  });
}

/**
 * Crear cuaderno. Encolable sin conexión (KIN-57), así que el `mutationFn`, el
 * placeholder y las keys que toca viven en `createPageSpec` — la cola necesita
 * reproducirlos tras cerrar el navegador, cuando este hook ya no existe.
 *
 * `systemId` viaja dentro de las variables, no en el closure, por lo mismo: es lo
 * único que se persiste de una mutación pausada.
 */
export function useCreatePage(systemId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation<PageListItem, Error, CreatePageInput>({
    mutationKey: createPageSpec.mutationKey,
    mutationFn: createPageSpec.mutationFn,
    networkMode: "offlineFirst",
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: pageKeys.bySystem(data.systemId) });
      applyOptimistic(queryClient, createPageSpec, data);
    },
    onSuccess: (created, data) => applyCreated(queryClient, createPageSpec, data, created),
    onError: (_err, data) => revertOptimistic(queryClient, createPageSpec, data),
    onSettled: (_data, _err, data) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.bySystem(data.systemId) });
    },
  });

  const stamped = useStampedMutation(mutation);
  const { mutate: stampedMutate, mutateAsync: stampedMutateAsync } = stamped;

  // Los llamantes siguen pasando el cuaderno sin `systemId`: lo pone el hook.
  // Las deps son las funciones (estables), no `stamped`, que cambia cada render.
  const mutate = useCallback(
    (data: Omit<CreatePageInput, "systemId">, options?: Parameters<typeof stampedMutate>[1]) =>
      stampedMutate({ ...data, systemId }, options),
    [stampedMutate, systemId],
  );
  const mutateAsync = useCallback(
    (data: Omit<CreatePageInput, "systemId">, options?: Parameters<typeof stampedMutateAsync>[1]) =>
      stampedMutateAsync({ ...data, systemId }, options),
    [stampedMutateAsync, systemId],
  );

  return { ...stamped, mutate, mutateAsync };
}

export function useUpdatePage(pageId: string, systemId?: string) {
  const qc = useQueryClient();

  // Multi-key: optimista sobre la lista (bySystem, donde se ve pin/rename al
  // instante) + escribe el detalle en onSuccess. Por eso se queda inline.
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
    onMutate: async (data) => {
      if (!systemId) return {};
      const listKey = pageKeys.bySystem(systemId);
      await qc.cancelQueries({ queryKey: listKey });
      const previousList = qc.getQueryData<PageListItem[]>(listKey);
      qc.setQueryData<PageListItem[]>(listKey, (old = []) =>
        old.map((p) => (p.id === pageId ? { ...p, ...data } : p)),
      );
      return { previousList, listKey };
    },
    onSuccess: (updated) => {
      qc.setQueryData<PageDetail>(pageKeys.detail(pageId), (old) =>
        old ? { ...old, ...updated } : undefined
      );
    },
    onError: (_err, _vars, ctx) => {
      const c = ctx as { previousList?: PageListItem[]; listKey?: readonly unknown[] } | undefined;
      if (c?.previousList && c.listKey) qc.setQueryData(c.listKey, c.previousList);
    },
    onSettled: () => {
      if (systemId) qc.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
    },
  });
}

export function useDeletePage(systemId: string) {
  return useOptimisticListMutation<void, Error, string, PageListItem>({
    mutationFn: async (pageId) => {
      const res = await fetch(`/api/pages/${pageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete page");
    },
    queryKey: pageKeys.bySystem(systemId),
    updater: (pages, pageId) => pages.filter((p) => p.id !== pageId),
    // Prefijo ['pages'] → reconcilia lista, detalle y linkedTasks de golpe.
    invalidateKey: ["pages"],
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
  return useOptimisticListMutation<
    PageListItem,
    Error,
    { title?: string; content?: string },
    PageListItem
  >({
    mutationFn: async (data) => {
      const res = await fetch(`/api/pages/${parentPageId}/subpages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemId }),
      });
      if (!res.ok) throw new Error("Failed to create sub-page");
      const page = await res.json() as PageListItem;
      // La ruta de subpáginas solo acepta el parent; título y plantilla del
      // medium (W3) se aplican en un PATCH inmediato.
      if (data.title || data.content) {
        await fetch(`/api/pages/${page.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(data.title ? { title: data.title } : {}),
            ...(data.content ? { content: data.content } : {}),
          }),
        });
      }
      return page;
    },
    queryKey: pageKeys.subPages(parentPageId),
    updater: (subPages, data) => [
      ...subPages,
      // Mismo constructor que la creación normal: una sola definición de cómo se
      // ve un cuaderno todavía sin confirmar.
      createPageSpec.optimistic({ systemId, parentPageId, title: data.title }),
    ],
    // Prefijo ['pages'] → reconcilia subpáginas y la lista del sistema.
    invalidateKey: ["pages"],
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
