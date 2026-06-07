import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { createFolderSchema } from "@/features/folders/folders.schemas";
import { createFolder, getFoldersBySystem } from "@/features/folders/folders.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id: systemId } = await params;
  const list = await getFoldersBySystem(systemId, ctx.userId);
  return NextResponse.json(list);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id: systemId } = await params;
  const body = await request.json();
  const parsed = createFolderSchema.safeParse({ ...body, systemId });

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const folder = await createFolder(ctx.userId, parsed.data);
    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    console.error("POST /api/systems/[id]/folders error:", error);
    return NextResponse.json({ code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" }, { status: 500 });
  }
}
