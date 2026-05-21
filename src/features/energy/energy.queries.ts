import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/shared/db';
import { energyCheckins, tasks, userEnergyProfile } from '@/shared/db/schema';
import type { CreateCheckinInput } from './energy.schemas';

export async function upsertCheckin(userId: string, date: string, input: CreateCheckinInput) {
  const [row] = await db
    .insert(energyCheckins)
    .values({
      userId,
      date,
      currentLevel: input.currentLevel,
      sleepQuality: input.sleepQuality,
    })
    .onConflictDoUpdate({
      target: [energyCheckins.userId, energyCheckins.date],
      set: {
        currentLevel: input.currentLevel,
        sleepQuality: input.sleepQuality,
      },
    })
    .returning();
  return row;
}

export async function getCheckinByDate(userId: string, date: string) {
  const [row] = await db
    .select()
    .from(energyCheckins)
    .where(and(eq(energyCheckins.userId, userId), eq(energyCheckins.date, date)))
    .limit(1);
  return row ?? null;
}

export async function getPlanCandidateTasks(userId: string) {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        inArray(tasks.status, ['today', 'tomorrow', 'week']),
        isNull(tasks.deletedAt),
      ),
    );
}

export async function getUserEnergyProfile(userId: string) {
  const [row] = await db
    .select()
    .from(userEnergyProfile)
    .where(eq(userEnergyProfile.userId, userId))
    .limit(1);
  return row ?? null;
}
