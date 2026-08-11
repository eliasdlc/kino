import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { users, userEnergyProfile, userSettings } from '@/shared/db/schema';
import type { ArchetypeIdentity } from './onboarding.archetypes';
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

/**
 * Guarda el segmento con el que la persona se identificó. Upsert porque la fila
 * de `user_settings` puede no existir todavía al terminar el onboarding.
 */
export async function saveArchetypeIdentity(userId: string, identity: ArchetypeIdentity) {
  await db
    .insert(userSettings)
    .values({ userId, archetypeIdentity: identity })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { archetypeIdentity: identity, updatedAt: new Date() },
    });
}

/**
 * Fija la timezone IANA capturada en el cliente. Se escribe antes de sembrar,
 * no al cerrar el onboarding: todo cálculo de "hoy" del servidor la lee desde
 * la fila del usuario.
 */
export async function saveUserTimezone(userId: string, timezone: string) {
  await db
    .update(users)
    .set({ timezone, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function markOnboardingComplete(userId: string) {
  await db
    .update(users)
    .set({ onboardingCompleted: true, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
