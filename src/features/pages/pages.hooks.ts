"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimisticList } from "@/shared/hooks/optimistic";
import {
  applyCreated,
  applyOptimistic,
  createPageSpec,
  revertOptimistic,
} from "@/features/offline/offline.mutations";
import { useStampedMutation } from "@/features/offline/offline.hooks";
import { pageKeys } from "./pages.keys";
import type { PageDetailTransport, PageListItemTransport, PageMutationResultTransport } from "./pages.types";
import type { CreatePageInput, UpdatePageInput } from "./pages.schemas";
import { api } from "@/shared/api/client";

// El placeholder optimista vive ahora en `createPageSpec` (KIN-57): la cola
// offline tiene que poder redibujarlo sin este módulo montado.
export { pageKeys } from "./pages.keys";

export function usePages(systemId: string) {
  return useQuery({
    queryKey: pageKeys.bySystem(systemId),
    queryFn: () => api.pages.bySystem({ systemId }),
    refetchOnWindowFocus: true,
  });
}

export function usePage(pageId: string) {
  return useQuery({
    queryKey: pageKeys.detail(pageId),
    queryFn: () => api.pages.byId({ id: pageId }),
    refetchOnWindowFocus: true,
  });
}

export function useLinkedTasks(pageId: string) {
  return useQuery({
    queryKey: pageKeys.linkedTasks(pageId),
    queryFn: () => api.pages.linkedTasks({ id: pageId }),
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

  const mutation = useMutation<PageListItemTransport, Error, CreatePageInput>({
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
  return useMutation<PageMutationResultTransport, Error, UpdatePageInput>({
    mutationFn: (data) => api.pages.update({ id: pageId, ...data }),
    onMutate: async (data) => {
      if (!systemId) return {};
      const listKey = pageKeys.bySystem(systemId);
      await qc.cancelQueries({ queryKey: listKey });
      const previousList = qc.getQueryData<PageListItemTransport[]>(listKey);
      qc.setQueryData<PageListItemTransport[]>(listKey, (old = []) =>
        old.map((p) => (p.id === pageId ? { ...p, ...data } : p)),
      );
      return { previousList, listKey };
    },
    onSuccess: (updated) => {
      qc.setQueryData<PageDetailTransport>(pageKeys.detail(pageId), (old) =>
        old ? { ...old, ...updated } : undefined
      );
    },
    onError: (_err, _vars, ctx) => {
      const c = ctx as { previousList?: PageListItemTransport[]; listKey?: readonly unknown[] } | undefined;
      if (c?.previousList && c.listKey) qc.setQueryData(c.listKey, c.previousList);
    },
    onSettled: () => {
      if (systemId) qc.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
    },
  });
}

export function useDeletePage(systemId: string) {
  return useOptimisticList<void, Error, string, PageListItemTransport>({
    mutationFn: (pageId) => api.pages.remove({ id: pageId }),
    queryKey: pageKeys.bySystem(systemId),
    updater: (pages, pageId) => pages.filter((p) => p.id !== pageId),
    // Prefijo ['pages'] → reconcilia lista, detalle y linkedTasks de golpe.
    invalidateKey: ["pages"],
  });
}

export function useLinkTask(pageId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (taskId) => api.pages.linkTask({ id: pageId, taskId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pageKeys.linkedTasks(pageId) });
      qc.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
    },
  });
}

export function useUnlinkTask(pageId: string) {
  const qc = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (taskId) => api.pages.unlinkTask({ id: pageId, taskId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pageKeys.linkedTasks(pageId) });
      qc.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
    },
  });
}

export function usePageTags(pageId: string) {
  return useQuery({
    queryKey: pageKeys.tags(pageId),
    queryFn: () => api.pages.tags({ id: pageId }),
    staleTime: 30_000,
  });
}

export function useAddPageTag(pageId: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (tagId) => api.pages.addTag({ id: pageId, tagId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pageKeys.tags(pageId) });
      qc.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
    },
  });
}

export function useSubPages(parentPageId: string) {
  return useQuery({
    queryKey: pageKeys.subPages(parentPageId),
    queryFn: () => api.pages.subpages({ id: parentPageId }),
    staleTime: 10_000,
  });
}

export function useCreateSubPage(parentPageId: string, systemId: string) {
  return useOptimisticList<
    PageListItemTransport,
    Error,
    { title?: string; content?: string },
    PageListItemTransport
  >({
    mutationFn: async (data) => {
      const page = await api.pages.createSubpage({ id: parentPageId, systemId });
      // La operación de subpáginas sólo acepta el parent; título y plantilla del
      // medium (W3) se aplican en un PATCH inmediato.
      if (data.title || data.content) {
        await api.pages.update({
          id: page.id,
          ...(data.title ? { title: data.title } : {}),
          ...(data.content ? { content: data.content } : {}),
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
      await api.pages.removeTag({ id: pageId, tagId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pageKeys.tags(pageId) });
      qc.invalidateQueries({ queryKey: pageKeys.bySystem(systemId) });
    },
  });
}
