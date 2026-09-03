"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EntityListItemTransport } from "./entities.types";
import {
  fetchSystemEntities,
  fetchEntity,
  fetchPageEntities,
  fetchUniverseGraph,
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
  graph: (systemId: string) => ["entities", "graph", systemId] as const,
};

export function useUniverseGraph(systemId: string, enabled = true) {
  return useQuery({
    queryKey: entityKeys.graph(systemId),
    queryFn: () => fetchUniverseGraph(systemId),
    enabled,
    staleTime: 30_000,
  });
}

export function useSystemEntities(systemId: string) {
  return useQuery({
    queryKey: entityKeys.bySystem(systemId),
    queryFn: () => fetchSystemEntities(systemId),
    staleTime: 30_000,
  });
}

export function usePageEntities(pageId: string) {
  return useQuery({
    queryKey: entityKeys.byPage(pageId),
    queryFn: () => fetchPageEntities(pageId),
    // El codex del capítulo se recalcula al guardar (autosave ~1.5s); refrescar al
    // volver a la ventana mantiene el rail alineado con lo escrito.
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });
}

export function useEntity(entityId: string | null) {
  return useQuery({
    queryKey: entityKeys.detail(entityId ?? "none"),
    queryFn: () => fetchEntity(entityId!),
    enabled: !!entityId,
  });
}

export function useCreateEntity(systemId: string) {
  const qc = useQueryClient();
  return useMutation<EntityListItemTransport, Error, CreateEntityBody>({
    mutationFn: (body) => createEntityApi(systemId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entityKeys.bySystem(systemId) });
      qc.invalidateQueries({ queryKey: entityKeys.graph(systemId) });
      qc.invalidateQueries({ queryKey: ["entities", "page"] });
    },
  });
}

export function useUpdateEntity(entityId: string, systemId: string) {
  const qc = useQueryClient();
  return useMutation<EntityListItemTransport, Error, Partial<CreateEntityBody>>({
    mutationFn: (body) => updateEntityApi(entityId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entityKeys.detail(entityId) });
      qc.invalidateQueries({ queryKey: entityKeys.bySystem(systemId) });
      qc.invalidateQueries({ queryKey: entityKeys.graph(systemId) });
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
      qc.invalidateQueries({ queryKey: entityKeys.graph(systemId) });
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
      // El grafo es el dibujo de estas mismas relaciones: crear una arista tiene
      // que redibujarlo aunque el usuario la haya creado desde la ficha.
      qc.invalidateQueries({ queryKey: ["entities", "graph"] });
    },
  });
}

export function useDeleteRelation(fromEntityId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (relationId) => deleteRelationApi(fromEntityId, relationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: entityKeys.detail(fromEntityId) });
      // El grafo es el dibujo de estas mismas relaciones: crear una arista tiene
      // que redibujarlo aunque el usuario la haya creado desde la ficha.
      qc.invalidateQueries({ queryKey: ["entities", "graph"] });
    },
  });
}
