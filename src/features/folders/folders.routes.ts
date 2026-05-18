import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { updateFolderSchema } from "./folders.schemas";
import { updateFolder, deleteFolder } from "./folders.service";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = updateFolderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateFolder(id, session.user.id, parsed.data);
  if (!updated) return NextResponse.json({ code: "NOT_FOUND", message: "Folder not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteFolder(id, session.user.id);
  if (!ok) return NextResponse.json({ code: "NOT_FOUND", message: "Folder not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
