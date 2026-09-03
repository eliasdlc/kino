import { implement } from "@orpc/server";
import { authenticate, translateDomainErrors, type ApiContext } from "@/shared/api/procedures";
import { NotFoundError } from "@/shared/utils/error";
import { entitiesContract } from "./entities.contract";
import {
  createEntity,
  createRelation,
  deleteEntity,
  deleteRelation,
  getEntityById,
  getMentionedEntities,
  getUniverseGraph,
  listEntities,
  updateEntity,
} from "./entities.service";

const os = implement(entitiesContract)
  .$context<ApiContext>()
  .use(translateDomainErrors)
  .use(authenticate);

export const entitiesRouter = os.router({
  bySystem: os.bySystem.handler(({ context, input }) =>
    listEntities(input.systemId, context.userId),
  ),

  create: os.create.handler(({ context, input }) => createEntity(context.userId, input)),

  graph: os.graph.handler(({ context, input }) =>
    getUniverseGraph(input.systemId, context.userId),
  ),

  byId: os.byId.handler(async ({ context, input }) => {
    const entity = await getEntityById(input.id, context.userId);
    if (!entity) throw new NotFoundError("Entity not found");
    return entity;
  }),

  update: os.update.handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const updated = await updateEntity(id, context.userId, data);
    if (!updated) throw new NotFoundError("Entity not found");
    return updated;
  }),

  remove: os.remove.handler(async ({ context, input }) => {
    const ok = await deleteEntity(input.id, context.userId);
    if (!ok) throw new NotFoundError("Entity not found");
  }),

  createRelation: os.createRelation.handler(({ context, input }) => {
    const { id, ...data } = input;
    return createRelation(id, context.userId, data);
  }),

  removeRelation: os.removeRelation.handler(async ({ context, input }) => {
    const ok = await deleteRelation(input.relationId, context.userId);
    if (!ok) throw new NotFoundError("Relation not found");
  }),

  byPage: os.byPage.handler(({ context, input }) =>
    getMentionedEntities(input.pageId, context.userId),
  ),
});
