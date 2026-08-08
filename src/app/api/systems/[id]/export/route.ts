import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { getSystemById } from "@/features/systems/systems.service";
import { getTasksBySystem } from "@/features/tasks/tasks.service";
import { getFoldersBySystem } from "@/features/folders/folders.service";
import { getPagesBySystem } from "@/features/pages/pages.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(request);
  if (!ctx) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;

  const [system, tasks, folders, pages] = await Promise.all([
    getSystemById(id, ctx.userId),
    getTasksBySystem(id, ctx.userId),
    getFoldersBySystem(id, ctx.userId),
    getPagesBySystem(id, ctx.userId),
  ]);

  if (!system) {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ system, tasks, folders, pages });
}
