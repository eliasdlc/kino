import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTasksByFolder } from "@/features/tasks/tasks.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id: systemId, folderId } = await params;
  const tasks = await getTasksByFolder(folderId, systemId, session.user.id);
  return NextResponse.json(tasks);
}
