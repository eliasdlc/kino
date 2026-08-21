import { NextResponse } from "next/server";
import { route } from "@/shared/utils/route";
import { NotFoundError } from "@/shared/utils/error";
import { updateTagSchema } from "./tags.schemas";
import { updateTag, deleteTag } from "./tags.service";

type IdParam = { id: string };

// PATCH/DELETE /api/tags/[id]
export const PATCH = route<IdParam>()(
  { body: updateTagSchema },
  async ({ userId, params, body }) => {
    const updated = await updateTag(params.id, userId, body);
    if (!updated) throw new NotFoundError("Tag not found");
    return NextResponse.json(updated);
  },
);

export const DELETE = route<IdParam>()({}, async ({ userId, params }) => {
  const ok = await deleteTag(params.id, userId);
  if (!ok) throw new NotFoundError("Tag not found");
  return new NextResponse(null, { status: 204 });
});
