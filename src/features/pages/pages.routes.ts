import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { createPageSchema, updatePageSchema, linkTaskSchema } from "./pages.schemas";
import {
  getPagesBySystem,
  createPage,
  getPageById,
  updatePage,
  deletePage,
  linkTaskToPage,
  unlinkTaskFromPage,
  getLinkedTasks,
} from "./pages.service";

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

// GET/POST /api/systems/[id]/pages
export async function getSystemPages(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id: systemId } = await params;
  const list = await getPagesBySystem(systemId, session.user.id);
  return NextResponse.json(list);
}

export async function createSystemPage(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id: systemId } = await params;
  const body = await request.json();
  const parsed = createPageSchema.safeParse({ ...body, systemId });

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const page = await createPage(session.user.id, parsed.data);
  return NextResponse.json(page, { status: 201 });
}

// GET/PATCH/DELETE /api/pages/[id]
export async function getPage(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const page = await getPageById(id, session.user.id);
  if (!page) return NextResponse.json({ code: "NOT_FOUND", message: "Page not found" }, { status: 404 });
  return NextResponse.json(page);
}

export async function patchPage(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = updatePageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updatePage(id, session.user.id, parsed.data);
  if (!updated) return NextResponse.json({ code: "NOT_FOUND", message: "Page not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function removePage(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await deletePage(id, session.user.id);
  if (!ok) return NextResponse.json({ code: "NOT_FOUND", message: "Page not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}

// GET/POST /api/pages/[id]/tasks  (linked tasks)
export async function getPageTasks(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const linked = await getLinkedTasks(id, session.user.id);
  return NextResponse.json(linked);
}

export async function linkPageTask(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = linkTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const newlyLinked = await linkTaskToPage(id, parsed.data.taskId, session.user.id);
    if (!newlyLinked) {
      return NextResponse.json({ code: "CONFLICT", message: "Task is already linked to this page" }, { status: 409 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "ForbiddenError") {
      return NextResponse.json({ code: "FORBIDDEN", message: err.message }, { status: 403 });
    }
    return NextResponse.json({ code: "NOT_FOUND", message: "Page or Task not found" }, { status: 404 });
  }
}

// DELETE /api/pages/[id]/tasks/[taskId]
export async function unlinkPageTask(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });

  const { id, taskId } = await params;
  try {
    await unlinkTaskFromPage(id, taskId, session.user.id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ code: "NOT_FOUND", message: "Page not found" }, { status: 404 });
  }
}
