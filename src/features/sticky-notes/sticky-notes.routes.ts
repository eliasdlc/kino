import { NextRequest, NextResponse } from "next/server";
import { updateStickyNoteSchema } from "./sticky-notes.schemas";
import { updateStickyNote, deleteStickyNote } from "./sticky-notes.service";
import { getAuthContext } from "@/shared/utils/auth-context";

// PATCH /api/sticky-notes/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = updateStickyNoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateStickyNote(id, ctx.userId, parsed.data);
  if (!updated) return NextResponse.json({ code: "NOT_FOUND", message: "Note not found" }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/sticky-notes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteStickyNote(id, ctx.userId);
  if (!ok) return NextResponse.json({ code: "NOT_FOUND", message: "Note not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
