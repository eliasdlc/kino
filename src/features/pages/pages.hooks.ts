"use client";

import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import type { CreatePageInput, UpdatePageInput } from "./pages.schemas";

/**
 * Las páginas de un sistema. La query trae hasta `PAGE_LIST_LIMIT` y dice
 * cuántas quedaron fuera; el componente recibe la lista, y `restantes` está
 * ahí para el día que un sistema pase del tope.
 */
export function usePages(systemId: string) {
  const result = useConvexQuery(api.pages.bySystem, { systemId });
  return { ...result, data: result.data?.items, restantes: result.data?.restantes ?? 0 };
}

export function usePage(pageId: string) {
  return useConvexQuery(api.pages.byId, { id: pageId });
}

export function useLinkedTasks(pageId: string) {
  return useConvexQuery(api.pages.linkedTasks, { id: pageId });
}

export function useCreatePage(systemId: string) {
  return useConvexMutation(api.pages.create, {
    map: (data: Omit<CreatePageInput, "systemId">) => ({ ...data, systemId }),
  });
}

export function useUpdatePage(pageId: string, _systemId?: string) {
  return useConvexMutation(api.pages.update, {
    map: (data: UpdatePageInput) => ({ id: pageId, ...data }),
  });
}

export function useDeletePage(_systemId: string) {
  return useConvexMutation(api.pages.remove, { map: (pageId: string) => ({ id: pageId }) });
}

export function useLinkTask(pageId: string) {
  return useConvexMutation(api.pages.linkTask, { map: (taskId: string) => ({ id: pageId, taskId }) });
}

export function useUnlinkTask(pageId: string) {
  return useConvexMutation(api.pages.unlinkTask, { map: (taskId: string) => ({ id: pageId, taskId }) });
}

export function usePageTags(pageId: string) {
  return useConvexQuery(api.pages.tags, { id: pageId });
}

export function useAddPageTag(pageId: string, _systemId: string) {
  return useConvexMutation(api.pages.addTag, { map: (tagId: string) => ({ id: pageId, tagId }) });
}

export function useRemovePageTag(pageId: string, _systemId: string) {
  return useConvexMutation(api.pages.removeTag, { map: (tagId: string) => ({ id: pageId, tagId }) });
}

export function useSubPages(parentPageId: string) {
  return useConvexQuery(api.pages.subpages, { id: parentPageId });
}

/** Crea una subpágina del cuaderno, con el título y la plantilla del medio si llegan. */
export function useCreateSubPage(parentPageId: string, systemId: string) {
  return useConvexMutation(api.pages.create, {
    map: (data: { title?: string; content?: string }) => ({ systemId, parentPageId, ...data }),
  });
}
