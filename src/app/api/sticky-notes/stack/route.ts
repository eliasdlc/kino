import { NextRequest, NextResponse } from "next/server";
import { stackStickyNotesSchema } from "@/features/sticky-notes/sticky-notes.schemas";
import { stackStickyNotes } from "@/features/sticky-notes/sticky-notes.service";
import { getAuthContext } from "@/shared/utils/auth-context";

// POST /api/sticky-notes/stack
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = stackStickyNotesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { draggedId, targetId } = parsed.data;
  const result = await stackStickyNotes(draggedId, targetId, ctx.userId);
  if (!result) return NextResponse.json({ code: "NOT_FOUND", message: "Note not found" }, { status: 404 });
  return NextResponse.json(result);
}
