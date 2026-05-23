import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { setupProfileSchema } from './onboarding.schemas';
import { completeOnboarding } from './onboarding.service';
import { getEnergyProfile } from './onboarding.queries';

export async function completeOnboardingRoute(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = setupProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await completeOnboarding(session.user.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to complete onboarding' },
      { status: 500 },
    );
  }
}

export async function getOnboardingStatus() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 });
  }

  const profile = await getEnergyProfile(session.user.id);
  return NextResponse.json({ completed: !!profile });
}
