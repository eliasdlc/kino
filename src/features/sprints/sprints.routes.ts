import { NextResponse } from "next/server";
import { route } from "@/shared/utils/route";
import { NotFoundError } from "@/shared/utils/error";
import { updateSprintSchema } from "./sprints.schemas";
import { updateSprint, deleteSprint, closeSprint } from "./sprints.service";

type IdParam = { id: string };

// PATCH/DELETE /api/sprints/[id]
export const PATCH = route<IdParam>()(
  { body: updateSprintSchema },
  async ({ userId, params, body }) => {
    const updated = await updateSprint(params.id, userId, body);
    if (!updated) throw new NotFoundError("Sprint not found");
    return NextResponse.json(updated);
  },
);

export const DELETE = route<IdParam>()({}, async ({ userId, params }) => {
  const ok = await deleteSprint(params.id, userId);
  if (!ok) throw new NotFoundError("Sprint not found");
  return new NextResponse(null, { status: 204 });
});

// POST /api/sprints/[id]/close
export const postClose = route<IdParam>()({}, async ({ userId, params }) => {
  const closed = await closeSprint(params.id, userId);
  if (!closed) throw new NotFoundError("Sprint not found");
  return NextResponse.json(closed);
});
