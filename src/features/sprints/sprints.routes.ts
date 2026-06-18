import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { updateSprintSchema } from "./sprints.schemas";
import { updateSprint, deleteSprint, closeSprint } from "./sprints.service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSprintSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await updateSprint(id, ctx.userId, parsed.data);
  if (!updated) return NextResponse.json({ code: "NOT_FOUND", message: "Sprint not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteSprint(id, ctx.userId);
  if (!ok) return NextResponse.json({ code: "NOT_FOUND", message: "Sprint not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}

export async function postClose(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const closed = await closeSprint(id, ctx.userId);
  if (!closed) return NextResponse.json({ code: "NOT_FOUND", message: "Sprint not found" }, { status: 404 });
  return NextResponse.json(closed);
}
