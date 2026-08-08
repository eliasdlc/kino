import { NextRequest, NextResponse } from "next/server";
import { createSystemSchema, reorderSystemsSchema, updateSystemSchema } from "./systems.schemas";
import { createSystem, createInboxForUser, deactivateSystem, getUsersSystems, reorderSystem, updateSystem, assertNotInbox, getSystemById } from "./systems.service";
import { ForbiddenError, NotFoundError } from "@/shared/utils/error";
import { getAuthContext } from "@/shared/utils/auth-context";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  await createInboxForUser(ctx.userId);
  const userSystems = await getUsersSystems(ctx.userId);
  return NextResponse.json(userSystems);
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSystemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      details: parsed.error.flatten()
    }, { status: 400 });
  }

  const system = await createSystem(ctx.userId, parsed.data);

  return NextResponse.json(system, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = updateSystemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const currentSystem = await getSystemById(id, ctx.userId);

    if (!currentSystem) {
      return NextResponse.json({ code: "NOT_FOUND", message: "System not found" }, { status: 404 });
    }

    await assertNotInbox(currentSystem);

    // `metadata` es una bolsa compartida (tabs, composición, meta de palabras):
    // un PATCH que solo toca una clave no puede borrar las demás. `null` explícito
    // sigue significando "vacía la bolsa".
    const data =
      parsed.data.metadata == null
        ? parsed.data
        : {
            ...parsed.data,
            metadata: { ...(currentSystem.metadata ?? {}), ...parsed.data.metadata },
          };

    const updatedSystem = await updateSystem(id, ctx.userId, data);

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await deactivateSystem(id, ctx.userId);
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
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = reorderSystemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      code: "VALIDATION_ERROR",
      message: "Invalid input",
      details: parsed.error.flatten()
    }, { status: 400 });
  }

  await reorderSystem(ctx.userId, parsed.data.systemIds);
  return new NextResponse(null, { status: 204 });
}
