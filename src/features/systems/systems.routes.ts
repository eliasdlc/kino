import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { createSystemSchema, reorderSystemsSchema, updateSystemSchema } from "./systems.schemas";
import { createSystem, deactivateSystem, getUsersSystems, reorderSystem, updateSystem, assertNotInbox, getSystembyId } from "./systems.service";
import { ForbiddenError, NotFoundError } from "@/shared/utils/error";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const userSystems = await getUsersSystems(session.user.id)
  return NextResponse.json(userSystems);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSystemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      details: parsed.error.flatten()
    }, { status: 400 });
  }

  const userId = session.user.id;
  const system = await createSystem(userId, parsed.data);

  return NextResponse.json(system, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const parsed = updateSystemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const currentSystem = await getSystembyId(id, session.user.id);

    if (!currentSystem) {
      return NextResponse.json({ code: "NOT_FOUND", message: "System not found" }, { status: 404 });
    }

    await assertNotInbox(currentSystem);

    const updatedSystem = await updateSystem(id, session.user.id, parsed.data);

    if (!updatedSystem) return NextResponse.json({ code: "NOT_FOUND", message: "System not found" }, { status: 404 });

    return NextResponse.json(updatedSystem);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: error.message },
        { status: 403 }
      );
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ code: "NOT_FOUND", message: "System not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(
  _req: unknown,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await deactivateSystem(id, session.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ code: "NOT_FOUND", message: "System not found" }, { status: 404 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Cannot delete Inbox" }, { status: 403 });
    }
    throw error;
  }
}

export async function postReorder(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = reorderSystemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      details: parsed.error.flatten()
    }, { status: 400 });
  }

  await reorderSystem(session.user.id, parsed.data.systemIds);
  return new NextResponse(null, { status: 204 });
}
