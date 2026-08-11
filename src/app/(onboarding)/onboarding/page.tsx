import { OnboardingWizard } from '@/features/onboarding/OnboardingWizard';
import { identityFromLandingSlug } from '@/features/onboarding/onboarding.archetypes';

export default async function OnboardingPage({
  searchParams,
}: {
  // `?para=escritores` llega desde las landings por segmento: quien ya se
  // identificó en la landing no vuelve a elegir a ciegas.
  searchParams: Promise<{ para?: string }>;
}) {
  const { para } = await searchParams;
  return <OnboardingWizard initialIdentity={identityFromLandingSlug(para)} />;
}
