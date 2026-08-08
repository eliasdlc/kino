import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/shared/utils/auth-context';
import { db } from '@/shared/db';
import { tasks } from '@/shared/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { ensureTodayPlanRolled } from '@/features/tasks/tasks.service';

// Returns tasks in today's committed plan.
// Membresía desacoplada del status (PLAN-07 Fase 1): filtra solo por in_today_plan.
export async function GET(request: NextRequest) {
  const authContext = await getAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const userId = authContext.userId;

  // Rollover diario lazy: resetea/repuebla el plan si es de un día anterior.
  await ensureTodayPlanRolled(userId);

  const result = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        isNull(tasks.deletedAt),
        isNull(tasks.parentTaskId),
        eq(tasks.inTodayPlan, true),
      ),
    )
    .orderBy(tasks.sortIndex);

  return NextResponse.json(result);
}
