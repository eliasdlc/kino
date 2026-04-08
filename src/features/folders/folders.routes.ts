import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { createFolderSchema } from "./folders.schemas";
import { createFolder, getFoldersBySystem } from "./folders.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Unauthorized" },
      { status: 401 }
    );

  const { id: systemId } = await params;
  const folderList = await getFoldersBySystem(systemId, session.user.id);
  return NextResponse.json(folderList);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Unauthorized" },
      { status: 401 }
    );

  const { id: systemId } = await params;
  const body = await request.json();

  const parsed = createFolderSchema.safeParse({ ...body, systemId });
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    const folder = await createFolder(session.user.id, parsed.data);
    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    console.error("POST /api/systems/[id]/folders error:", error);
    return NextResponse.json(
      { code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" },
      { status: 500 }
    );
  }
}
