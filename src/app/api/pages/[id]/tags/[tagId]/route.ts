import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { removeTagFromPage } from "@/features/pages/pages.service";
import { NotFoundError } from "@/shared/utils/error";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const { id: pageId, tagId } = await params;
  try {
    await removeTagFromPage(pageId, tagId, ctx.userId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ code: "NOT_FOUND", message: err.message }, { status: 404 });
    }
    throw err;
  }
}
