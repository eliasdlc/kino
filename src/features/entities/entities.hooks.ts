"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  EntityListItem,
  EntityDetail,
  MentionedEntity,
} from "./entities.types";
import {
  fetchSystemEntities,
  fetchEntity,
  fetchPageEntities,
  createEntityApi,
  updateEntityApi,
  deleteEntityApi,
  createRelationApi,
  deleteRelationApi,
  type CreateEntityBody,
} from "./entities.client";

export const entityKeys = {
  bySystem: (systemId: string) => ["entities", "system", systemId] as const,
  detail: (entityId: string) => ["entities", "detail", entityId] as const,
  byPage: (pageId: string) => ["entities", "page", pageId] as const,
};

export function useSystemEntities(systemId: string) {
  return useQuery<EntityListItem[]>({
    queryKey: entityKeys.bySystem(systemId),
    queryFn: () => fetchSystemEntities(systemId),
    staleTime: 30_000,
  });
}

export function usePageEntities(pageId: string) {
  return useQuery<MentionedEntity[]>({
    queryKey: entityKeys.byPage(pageId),
    queryFn: () => fetchPageEntities(pageId),
    // El codex del capítulo se recalcula al guardar (autosave ~1.5s); refrescar al
    // volver a la ventana mantiene el rail alineado con lo escrito.
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });
}

export function useEntity(entityId: string | null) {
  return useQuery<EntityDetail>({
    queryKey: entityKeys.detail(entityId ?? "none"),
    queryFn: () => fetchEntity(entityId!),
    enabled: !!entityId,
  });
}

export function useCreateEntity(systemId: string) {
  const qc = useQueryClient();
  return useMutation<EntityListItem, Error, CreateEntityBody>({
    mutationFn: (body) => createEntityApi(systemId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entityKeys.bySystem(systemId) });
      qc.invalidateQueries({ queryKey: ["entities", "page"] });
    },
  });
}

export function useUpdateEntity(entityId: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation<EntityListItem, Error, Partial<CreateEntityBody>>({
    mutationFn: (body) => updateEntityApi(entityId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entityKeys.detail(entityId) });
      qc.invalidateQueries({ queryKey: entityKeys.bySystem(systemId) });
      qc.invalidateQueries({ queryKey: ["entities", "page"] });
    },
  });
}

export function useDeleteEntity(systemId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (entityId) => deleteEntityApi(entityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entityKeys.bySystem(systemId) });
      qc.invalidateQueries({ queryKey: ["entities", "page"] });
    },
  });
}

export function useCreateRelation(fromEntityId: string) {
  const qc = useQueryClient();
  return useMutation<
    unknown,
    Error,
    { toEntityId: string; label?: string | null; notes?: string | null }
  >({
    mutationFn: (body) => createRelationApi(fromEntityId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entityKeys.detail(fromEntityId) });
    },
  });
}

export function useDeleteRelation(fromEntityId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (relationId) => deleteRelationApi(fromEntityId, relationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entityKeys.detail(fromEntityId) });
    },
  });
}
