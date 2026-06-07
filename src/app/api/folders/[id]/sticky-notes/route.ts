import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { createStickyNoteSchema } from "@/features/sticky-notes/sticky-notes.schemas";
import {
  getStickyNotesByFolder,
  createStickyNote,
} from "@/features/sticky-notes/sticky-notes.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id: folderId } = await params;
  const notes = await getStickyNotesByFolder(folderId, ctx.userId);
  return NextResponse.json(notes);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id: folderId } = await params;
  const body = await request.json();
  const parsed = createStickyNoteSchema.omit({ pageId: true }).safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const note = await createStickyNote(ctx.userId, { ...parsed.data, folderId });
  return NextResponse.json(note, { status: 201 });
}
