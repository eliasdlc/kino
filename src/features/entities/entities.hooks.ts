"use client";

import { api } from "@convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/shared/convex/hooks";
import type { EntityAttributes, EntityType } from "./entities.attributes";

export interface CreateEntityBody {
  name: string;
  type: EntityType;
  aliases?: string[];
  summary?: string | null;
  attributes?: EntityAttributes | null;
  coverImageUrl?: string | null;
  images?: string[];
}

export function useUniverseGraph(systemId: string, enabled = true) {
  return useConvexQuery(api.entities.graph, { systemId }, { enabled });
}

export function useSystemEntities(systemId: string) {
  return useConvexQuery(api.entities.bySystem, { systemId });
}

export function usePageEntities(pageId: string) {
  return useConvexQuery(api.entities.byPage, { pageId });
}

export function useEntity(entityId: string | null) {
  return useConvexQuery(api.entities.byId, entityId ? { id: entityId } : "skip");
}

export function useCreateEntity(systemId: string) {
  return useConvexMutation(api.entities.create, {
    map: (body: CreateEntityBody) => ({ ...body, systemId }),
  });
}

export function useUpdateEntity(entityId: string, _systemId: string) {
  return useConvexMutation(api.entities.update, {
    map: (body: Partial<CreateEntityBody>) => ({ ...body, id: entityId }),
  });
}

export function useDeleteEntity(_systemId: string) {
  return useConvexMutation(api.entities.remove, { map: (entityId: string) => ({ id: entityId }) });
}

export function useCreateRelation(fromEntityId: string) {
  return useConvexMutation(api.entities.createRelation, {
    map: (body: { toEntityId: string; label?: string | null; notes?: string | null }) => ({ ...body, id: fromEntityId }),
  });
}

export function useDeleteRelation(fromEntityId: string) {
  return useConvexMutation(api.entities.removeRelation, {
    map: (relationId: string) => ({ id: fromEntityId, relationId }),
  });
}
