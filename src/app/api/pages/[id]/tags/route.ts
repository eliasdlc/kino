import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { getPageTagsList, addTagToPage } from "@/features/pages/pages.service";
import { NotFoundError } from "@/shared/utils/error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const { id: pageId } = await params;
  const tags = await getPageTagsList(pageId, ctx.userId);
  return NextResponse.json(tags);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const { id: pageId } = await params;
  const { tagId } = await request.json();
  if (!tagId || typeof tagId !== "string") {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "tagId required" }, { status: 400 });
  }

  try {
    await addTagToPage(pageId, tagId, ctx.userId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ code: "NOT_FOUND", message: err.message }, { status: 404 });
    }
    throw err;
  }
}
