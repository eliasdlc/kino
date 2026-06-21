import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/shared/utils/auth-context";
import { getScheduledTasks, ensureTodayPlanRolled } from "@/features/tasks/tasks.service";

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext(request);
  if (!ctx) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "from and to are required" },
      { status: 400 },
    );
  }

  await ensureTodayPlanRolled(ctx.userId);
  const tasks = await getScheduledTasks(ctx.userId, from, to);
  return NextResponse.json(tasks);
}
