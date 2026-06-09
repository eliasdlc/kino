import { createSystem } from '../systems/systems.service';
import {
  insertEnergyProfile,
  markOnboardingComplete,
} from './onboarding.queries';
import type { SetupProfileInput } from './onboarding.schemas';

export async function completeOnboarding(
  userId: string,
  input: SetupProfileInput,
) {
  await insertEnergyProfile(userId, input);
  await createSystem(userId, {
    name: input.firstSystemName,
    color: 'blue',
    icon: 'folder',
  });
  await markOnboardingComplete(userId, input.timezone);
}
