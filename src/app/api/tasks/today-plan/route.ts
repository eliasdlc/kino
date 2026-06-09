import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/shared/db';
import { tasks } from '@/shared/db/schema';
import { and, eq, isNull, or, sql } from 'drizzle-orm';

// Returns tasks in today's committed plan.
// Backward compatible: includes status='today' tasks until in_today_plan is fully migrated.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json([], { status: 401 });

  const userId = session.user.id;

  const result = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        isNull(tasks.deletedAt),
        isNull(tasks.parentTaskId),
        or(
          eq(tasks.inTodayPlan, true),
          sql`${tasks.status} = 'today'`,
        ),
      ),
    )
    .orderBy(tasks.sortIndex);

  return NextResponse.json(result);
}
