import { and, eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { energyCheckins } from '@/shared/db/schema';
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
