import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { getTasksByFolder } from "@/features/tasks/tasks.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id: systemId, folderId } = await params;
  const tasks = await getTasksByFolder(folderId, systemId, ctx.userId);
  return NextResponse.json(tasks);
}
