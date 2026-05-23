import { getOnboardingStatus } from '@/features/onboarding/onboarding.routes';

export function GET() {
  return getOnboardingStatus();
}
