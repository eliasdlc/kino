import { redirect } from 'next/navigation';
import { api } from '@convex/_generated/api';
import { serverQuery } from '@/shared/convex/server';
import { getServerSession } from '@/shared/utils/session';
import { AnalyticsIdentity } from '@/shared/observability/AnalyticsIdentity';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect('/login');

  const user = await serverQuery(api.users.current, {});
  if (user.onboardingCompleted) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-background">
      {/* Antes que `children`: sus efectos corren en ese orden, así que la
          persona ya está identificada cuando la pantalla de debajo dispara su
          primer evento del funnel. */}
      <AnalyticsIdentity userId={user._id} />
      {children}
    </div>
  );
}
