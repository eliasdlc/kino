import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { getSubPages, createPage } from "@/features/pages/pages.service";
import { createPageSchema } from "@/features/pages/pages.schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const { id: parentPageId } = await params;
  const list = await getSubPages(parentPageId, ctx.userId);
  return NextResponse.json(list);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const { id: parentPageId } = await params;
  const body = await request.json();
  const parsed = createPageSchema.safeParse({ ...body, parentPageId });

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const page = await createPage(ctx.userId, parsed.data);
  return NextResponse.json(page, { status: 201 });
}
