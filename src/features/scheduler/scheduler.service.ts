import { db } from '@/shared/db';
import { energyCheckins } from '@/shared/db/schema';
import { eq, sql } from 'drizzle-orm';
import { ensureYesterdaySnapshot } from '@/features/energy/energy.service';

const MAX_USERS_PER_RUN = 50;

// Obtiene los user_id distintos que hicieron check-in hoy (UTC)
async function getActiveUserIds(): Promise<string[]> {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const rows = await db
    .selectDistinct({ userId: energyCheckins.userId })
    .from(energyCheckins)
    .where(eq(energyCheckins.date, sql`${todayUtc}::date`))
    .limit(MAX_USERS_PER_RUN);
  return rows.map((r) => r.userId);
}

/**
 * Para cada usuario activo hoy (check-in realizado), garantiza que
 * el snapshot de ayer está calculado. Limitado a MAX_USERS_PER_RUN
 * para respetar el límite de 10s de Vercel Free.
 */
export async function runDailySnapshotForActiveUsers(): Promise<{ processed: number }> {
  const userIds = await getActiveUserIds();
  await Promise.all(userIds.map((id) => ensureYesterdaySnapshot(id)));
  return { processed: userIds.length };
}
