import { api } from "@/shared/api/client";
import type { EntityAttributes, EntityType } from "./entities.attributes";

/**
 * Las llamadas del codex, con nombre de dominio. Los tipos y las URLs salen del
 * contrato: aquí sólo queda el vocabulario del slice.
 */

export const fetchSystemEntities = (systemId: string) =>
  api.entities.bySystem({ systemId });

export const fetchUniverseGraph = (systemId: string) => api.entities.graph({ systemId });

export const fetchEntity = (entityId: string) => api.entities.byId({ id: entityId });

export const fetchPageEntities = (pageId: string) => api.entities.byPage({ pageId });

export interface CreateEntityBody {
  name: string;
  type: EntityType;
  aliases?: string[];
  summary?: string | null;
  attributes?: EntityAttributes | null;
  coverImageUrl?: string | null;
  images?: string[];
}

export const createEntityApi = (systemId: string, body: CreateEntityBody) =>
  api.entities.create({ ...body, systemId });

export const updateEntityApi = (
  entityId: string,
  body: Partial<CreateEntityBody> & { type?: EntityType },
) => api.entities.update({ ...body, id: entityId });

export const deleteEntityApi = (entityId: string) => api.entities.remove({ id: entityId });

export const createRelationApi = (
  fromEntityId: string,
  body: { toEntityId: string; label?: string | null; notes?: string | null },
) => api.entities.createRelation({ ...body, id: fromEntityId });

export const deleteRelationApi = (fromEntityId: string, relationId: string) =>
  api.entities.removeRelation({ id: fromEntityId, relationId });
