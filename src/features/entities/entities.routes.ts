import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { ForbiddenError } from "@/shared/utils/error";
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

const UNAUTHORIZED = { code: "UNAUTHORIZED", message: "Unauthorized" };

function validationError(details: unknown) {
  return NextResponse.json(
    { code: "VALIDATION_ERROR", message: "Invalid input", details },
    { status: 400 },
  );
}

// GET/POST /api/systems/[id]/entities  (biblioteca del universo)
export async function getSystemEntities(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: systemId } = await params;
  const list = await listEntities(systemId, ctx.userId);
  return NextResponse.json(list);
}

export async function createSystemEntity(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: systemId } = await params;
  const body = await request.json();
  const parsed = createEntitySchema.safeParse({ ...body, systemId });
  if (!parsed.success) return validationError(parsed.error.flatten());

  try {
    const entity = await createEntity(ctx.userId, parsed.data);
    return NextResponse.json(entity, { status: 201 });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ code: "FORBIDDEN", message: err.message }, { status: 403 });
    }
    throw err;
  }
}

// GET /api/systems/[id]/graph  (grafo del universo)
export async function getSystemGraph(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: systemId } = await params;
  return NextResponse.json(await getUniverseGraph(systemId, ctx.userId));
}

// GET/PATCH/DELETE /api/entities/[id]
export async function getEntity(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id } = await params;
  const entity = await getEntityById(id, ctx.userId);
  if (!entity) return NextResponse.json({ code: "NOT_FOUND", message: "Entity not found" }, { status: 404 });
  return NextResponse.json(entity);
}

export async function patchEntity(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = updateEntitySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  try {
    const updated = await updateEntity(id, ctx.userId, parsed.data);
    if (!updated) return NextResponse.json({ code: "NOT_FOUND", message: "Entity not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ code: "FORBIDDEN", message: err.message }, { status: 403 });
    }
    throw err;
  }
}

export async function removeEntity(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id } = await params;
  const ok = await deleteEntity(id, ctx.userId);
  if (!ok) return NextResponse.json({ code: "NOT_FOUND", message: "Entity not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}

// POST /api/entities/[id]/relations
export async function createEntityRelation(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: fromEntityId } = await params;
  const body = await request.json();
  const parsed = createRelationSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.flatten());

  try {
    const relation = await createRelation(fromEntityId, ctx.userId, parsed.data);
    return NextResponse.json(relation, { status: 201 });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ code: "FORBIDDEN", message: err.message }, { status: 403 });
    }
    throw err;
  }
}

// DELETE /api/entities/[id]/relations/[relationId]
export async function removeEntityRelation(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; relationId: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { relationId } = await params;
  try {
    const ok = await deleteRelation(relationId, ctx.userId);
    if (!ok) return NextResponse.json({ code: "NOT_FOUND", message: "Relation not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ code: "FORBIDDEN", message: err.message }, { status: 403 });
    }
    throw err;
  }
}

// GET /api/pages/[id]/entities  (codex rail contextual)
export async function getPageEntities(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json(UNAUTHORIZED, { status: 401 });

  const { id: pageId } = await params;
  const mentioned = await getMentionedEntities(pageId, ctx.userId);
  return NextResponse.json(mentioned);
}
