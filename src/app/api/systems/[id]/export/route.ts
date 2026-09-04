import { NextRequest, NextResponse } from "next/server";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { getServerSession } from "@/shared/utils/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;

  const system = await serverQuery(api.systems.byId, { id }).catch(() => null);
  if (!system) {
    return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  }
  const [tasks, folders, pages] = await Promise.all([
    serverQuery(api.tasks.bySystem, { systemId: id }),
    serverQuery(api.folders.bySystem, { systemId: id }),
    serverQuery(api.pages.bySystem, { systemId: id }),
  ]);

  return NextResponse.json({ system, tasks, folders, pages });
}
