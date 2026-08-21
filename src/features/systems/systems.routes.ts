import { NextResponse } from "next/server";
import { route } from "@/shared/utils/route";
import { createSystemSchema, reorderSystemsSchema, updateSystemSchema } from "./systems.schemas";
import {
  createSystem,
  createInboxForUser,
  deactivateSystem,
  getUsersSystems,
  reorderSystem,
  updateSystem,
  assertNotInbox,
  getSystemById,
} from "./systems.service";
import { NotFoundError } from "@/shared/utils/error";

type IdParam = { id: string };

// GET/POST /api/systems
export const GET = route()({}, async ({ userId }) => {
  await createInboxForUser(userId);
  return NextResponse.json(await getUsersSystems(userId));
});

export const POST = route()({ body: createSystemSchema }, async ({ userId, body }) =>
  NextResponse.json(await createSystem(userId, body), { status: 201 }),
);

// PATCH/DELETE /api/systems/[id]
export const PATCH = route<IdParam>()(
  { body: updateSystemSchema },
  async ({ userId, params, body }) => {
    const currentSystem = await getSystemById(params.id, userId);
    if (!currentSystem) throw new NotFoundError("System not found");

    await assertNotInbox(currentSystem);

    // `metadata` es una bolsa compartida (tabs, composición, meta de palabras):
    // un PATCH que solo toca una clave no puede borrar las demás. `null` explícito
    // sigue significando "vacía la bolsa".
    const data =
      body.metadata == null
        ? body
        : { ...body, metadata: { ...(currentSystem.metadata ?? {}), ...body.metadata } };

    const updatedSystem = await updateSystem(params.id, userId, data);
    if (!updatedSystem) throw new NotFoundError("System not found");
    return NextResponse.json(updatedSystem);
  },
);

export const DELETE = route<IdParam>()({}, async ({ userId, params }) => {
  await deactivateSystem(params.id, userId);
  return new NextResponse(null, { status: 204 });
});

// POST /api/systems/reorder
export const postReorder = route()(
  { body: reorderSystemsSchema },
  async ({ userId, body }) => {
    await reorderSystem(userId, body.systemIds);
    return new NextResponse(null, { status: 204 });
  },
);
