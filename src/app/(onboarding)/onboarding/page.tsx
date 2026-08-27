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
  const initialIdentity = identityFromLandingSlug(para);
  // El slug sólo viaja a la medición si el manifiesto lo reconoce: uno inventado
  // ni preselecciona identidad ni ensucia la dimensión del funnel.
  return (
    <OnboardingWizard
      initialIdentity={initialIdentity}
      segment={initialIdentity ? (para ?? null) : null}
    />
  );
}
