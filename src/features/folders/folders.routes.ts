import { NextRequest, NextResponse } from "next/server";
import { updateFolderSchema } from "./folders.schemas";
import { updateFolder, deleteFolder, getFolderById } from "./folders.service";
import { parseFolderMetadata } from "./folders.metadata";
import { getSystembyId } from "@/features/systems/systems.service";
import { getAuthContext } from "@/shared/utils/auth-context";
import type { SystemType } from "@/shared/lib/system-types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = updateFolderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Solo si el update toca metadata resolvemos el arquetipo del folder para
  // validarla; un rename simple no paga esas queries.
  if (data.metadata !== undefined) {
    const folder = await getFolderById(id, ctx.userId);
    if (!folder) return NextResponse.json({ code: "NOT_FOUND", message: "Folder not found" }, { status: 404 });
    const system = folder.systemId ? await getSystembyId(folder.systemId, ctx.userId) : null;
    const meta = parseFolderMetadata((system?.templateType ?? "custom") as SystemType, data.metadata);
    if (!meta.success) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Invalid folder metadata", details: meta.error.flatten() },
        { status: 400 }
      );
    }
    data.metadata = meta.data;
  }

  const updated = await updateFolder(id, ctx.userId, data);
  if (!updated) return NextResponse.json({ code: "NOT_FOUND", message: "Folder not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteFolder(id, ctx.userId);
  if (!ok) return NextResponse.json({ code: "NOT_FOUND", message: "Folder not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
