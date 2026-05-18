import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createStickyNoteSchema } from "@/features/sticky-notes/sticky-notes.schemas";
import {
  getStickyNotesByPage,
  createStickyNote,
} from "@/features/sticky-notes/sticky-notes.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id: pageId } = await params;
  const notes = await getStickyNotesByPage(pageId, session.user.id);
  return NextResponse.json(notes);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id: pageId } = await params;
  const body = await request.json();
  const parsed = createStickyNoteSchema.omit({ folderId: true }).safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const note = await createStickyNote(session.user.id, { ...parsed.data, pageId });
  return NextResponse.json(note, { status: 201 });
}
