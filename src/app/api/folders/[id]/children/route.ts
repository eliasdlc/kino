import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFolderChildren } from "@/features/folders/folders.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id: folderId } = await params;
  const children = await getFolderChildren(folderId, session.user.id);
  return NextResponse.json(children);
}
