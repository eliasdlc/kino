import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { users, userEnergyProfile } from '@/shared/db/schema';
import type { SetupProfileInput } from './onboarding.schemas';

export async function insertEnergyProfile(
  userId: string,
  input: SetupProfileInput,
) {
  await db.insert(userEnergyProfile).values({
    userId,
    chronotype: input.chronotype,
    sleepTypicalHours: input.sleepTypicalHours,
    availableHoursPerDay: input.availableHoursPerDay,
    rechargePresets: JSON.stringify(input.rechargePresets),
  });
}

export async function getEnergyProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(userEnergyProfile)
    .where(eq(userEnergyProfile.userId, userId))
    .limit(1);
  return profile ?? null;
}

export async function markOnboardingComplete(userId: string, timezone?: string) {
  await db
    .update(users)
    .set({
      onboardingCompleted: true,
      ...(timezone ? { timezone } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
