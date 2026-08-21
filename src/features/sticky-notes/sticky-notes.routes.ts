import { NextResponse } from "next/server";
import { route } from "@/shared/utils/route";
import { NotFoundError } from "@/shared/utils/error";
import { updateStickyNoteSchema } from "./sticky-notes.schemas";
import { updateStickyNote, deleteStickyNote } from "./sticky-notes.service";

type IdParam = { id: string };

// PATCH/DELETE /api/sticky-notes/[id]
export const PATCH = route<IdParam>()(
  { body: updateStickyNoteSchema },
  async ({ userId, params, body }) => {
    const updated = await updateStickyNote(params.id, userId, body);
    if (!updated) throw new NotFoundError("Note not found");
    return NextResponse.json(updated);
  },
);

export const DELETE = route<IdParam>()({}, async ({ userId, params }) => {
  const ok = await deleteStickyNote(params.id, userId);
  if (!ok) throw new NotFoundError("Note not found");
  return new NextResponse(null, { status: 204 });
});
