import { NextRequest } from 'next/server';
import { completeOnboardingRoute } from '@/features/onboarding/onboarding.routes';

export function POST(request: NextRequest) {
  return completeOnboardingRoute(request);
}
