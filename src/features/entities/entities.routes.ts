import { NextResponse } from "next/server";
import { route } from "@/shared/utils/route";
import { NotFoundError } from "@/shared/utils/error";
import {
  createEntitySchema,
  updateEntitySchema,
  createRelationSchema,
} from "./entities.schemas";
import {
  listEntities,
  getEntityById,
  createEntity,
  updateEntity,
  deleteEntity,
  createRelation,
  deleteRelation,
  getMentionedEntities,
  getUniverseGraph,
} from "./entities.service";

// Migrado al wrapper `route` (KIN-145): auth, validación de body y mapeo de
// errores viven ahí. El ForbiddenError que lanza el servicio sale como 403 y el
// NotFoundError como 404, con los mismos mensajes y status que antes.

type IdParam = { id: string };

// GET/POST /api/systems/[id]/entities  (biblioteca del universo)
export const getSystemEntities = route<IdParam>()({}, async ({ userId, params }) =>
  NextResponse.json(await listEntities(params.id, userId)),
);

export const createSystemEntity = route<IdParam>()(
  {
    body: createEntitySchema,
    // `systemId` viaja en la URL, no en el body, pero el schema lo exige.
    prepareBody: (raw, params) => ({ ...(raw as object), systemId: params.id }),
  },
  async ({ userId, body }) => NextResponse.json(await createEntity(userId, body), { status: 201 }),
);

// GET /api/systems/[id]/graph  (grafo del universo)
export const getSystemGraph = route<IdParam>()({}, async ({ userId, params }) =>
  NextResponse.json(await getUniverseGraph(params.id, userId)),
);

// GET/PATCH/DELETE /api/entities/[id]
export const getEntity = route<IdParam>()({}, async ({ userId, params }) => {
  const entity = await getEntityById(params.id, userId);
  if (!entity) throw new NotFoundError("Entity not found");
  return NextResponse.json(entity);
});

export const patchEntity = route<IdParam>()(
  { body: updateEntitySchema },
  async ({ userId, params, body }) => {
    const updated = await updateEntity(params.id, userId, body);
    if (!updated) throw new NotFoundError("Entity not found");
    return NextResponse.json(updated);
  },
);

export const removeEntity = route<IdParam>()({}, async ({ userId, params }) => {
  const ok = await deleteEntity(params.id, userId);
  if (!ok) throw new NotFoundError("Entity not found");
  return new NextResponse(null, { status: 204 });
});

// POST /api/entities/[id]/relations
export const createEntityRelation = route<IdParam>()(
  { body: createRelationSchema },
  async ({ userId, params, body }) =>
    NextResponse.json(await createRelation(params.id, userId, body), { status: 201 }),
);

// DELETE /api/entities/[id]/relations/[relationId]
export const removeEntityRelation = route<{ id: string; relationId: string }>()(
  {},
  async ({ userId, params }) => {
    const ok = await deleteRelation(params.relationId, userId);
    if (!ok) throw new NotFoundError("Relation not found");
    return new NextResponse(null, { status: 204 });
  },
);

// GET /api/pages/[id]/entities  (codex rail contextual)
export const getPageEntities = route<IdParam>()({}, async ({ userId, params }) =>
  NextResponse.json(await getMentionedEntities(params.id, userId)),
);
