import { z } from "zod";
import { endpoint, noContent, output } from "@/shared/api/contract";
import {
  createEntitySchema,
  createRelationSchema,
  updateEntitySchema,
} from "./entities.schemas";
import type { UniverseGraph } from "./entities.graph";
import type {
  EntityDetail,
  EntityListItem,
  EntityRelationItem,
  MentionedEntity,
} from "./entities.types";

/** El codex del universo: entidades, sus relaciones y el grafo que forman. */
export const entitiesContract = {
  bySystem: endpoint
    .route({ method: "GET", path: "/systems/{systemId}/entities" })
    .input(z.object({ systemId: z.string().uuid() }))
    .output(output<EntityListItem[]>()),

  create: endpoint
    .route({ method: "POST", path: "/systems/{systemId}/entities", successStatus: 201 })
    .input(createEntitySchema.extend({ systemId: z.string().uuid() }))
    .output(output<EntityListItem>()),

  graph: endpoint
    .route({ method: "GET", path: "/systems/{systemId}/graph" })
    .input(z.object({ systemId: z.string().uuid() }))
    .output(output<UniverseGraph>()),

  byId: endpoint
    .route({ method: "GET", path: "/entities/{id}" })
    .input(z.object({ id: z.string().uuid() }))
    .output(output<EntityDetail>()),

  update: endpoint
    .route({ method: "PATCH", path: "/entities/{id}" })
    .input(updateEntitySchema.extend({ id: z.string().uuid() }))
    .output(output<EntityListItem>()),

  remove: endpoint
    .route({ method: "DELETE", path: "/entities/{id}", successStatus: 204 })
    .input(z.object({ id: z.string().uuid() }))
    .output(noContent()),

  createRelation: endpoint
    .route({ method: "POST", path: "/entities/{id}/relations", successStatus: 201 })
    .input(createRelationSchema.extend({ id: z.string().uuid() }))
    .output(output<EntityRelationItem>()),

  removeRelation: endpoint
    .route({
      method: "DELETE",
      path: "/entities/{id}/relations/{relationId}",
      successStatus: 204,
    })
    .input(z.object({ id: z.string().uuid(), relationId: z.string().uuid() }))
    .output(noContent()),

  /** Las entidades mencionadas en una página: el rail contextual del codex. */
  byPage: endpoint
    .route({ method: "GET", path: "/pages/{pageId}/entities" })
    .input(z.object({ pageId: z.string().uuid() }))
    .output(output<MentionedEntity[]>()),
};
