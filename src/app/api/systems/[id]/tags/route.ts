import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { createTagSchema } from "@/features/tags/tags.schemas";
import { createTag, getTagsBySystem } from "@/features/tags/tags.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id: systemId } = await params;
  const list = await getTagsBySystem(systemId, ctx.userId);
  return NextResponse.json(list);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id: systemId } = await params;
  const body = await request.json();
  const parsed = createTagSchema.safeParse({ ...body, systemId });

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const tag = await createTag(ctx.userId, parsed.data);
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error("POST /api/systems/[id]/tags error:", error);
    return NextResponse.json({ code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" }, { status: 500 });
  }
}
