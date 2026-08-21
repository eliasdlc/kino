import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/db';
import { users } from '@/shared/db/schema';
import { getServerSession } from '@/shared/utils/session';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect('/login');

  const [user] = await db
    .select({ onboardingCompleted: users.onboardingCompleted })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (user?.onboardingCompleted) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
