import { db } from '@/shared/db';
import { energyCheckins } from '@/shared/db/schema';
import { eq, sql } from 'drizzle-orm';
import { ensureYesterdaySnapshot, checkLevel1Triggers, calibrateLearnedCurve } from '@/features/energy/energy.service';
import { sendPushToUser } from '@/features/notifications/notifications.service';

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

  await Promise.all(
    userIds.map(async (userId) => {
      await ensureYesterdaySnapshot(userId);
      await calibrateLearnedCurve(userId);

      const triggers = await checkLevel1Triggers(userId);

      if (triggers.overloadToday) {
        await sendPushToUser(userId, {
          title: 'Kino · Sobrecarga detectada',
          body: 'Tienes más tareas hoy de las que tu energía puede sostener. Revisemos el plan.',
          url: '/dashboard',
        });
      }

      if (triggers.thresholdCrossing) {
        await sendPushToUser(userId, {
          title: 'Kino · Energía baja',
          body: 'Tu energía está cerca del piso. Considera tomar un descanso antes de continuar.',
          url: '/dashboard',
        });
      }
    }),
  );

  return { processed: userIds.length };
}
