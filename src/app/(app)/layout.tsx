import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/shared/db";
import { users } from "@/shared/db/schema";
import { Providers } from "./providers";
import { SystemsSidebar } from "@/features/systems/SystemsSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";

import { GlobalCommandPalette } from "@/features/command-palette/GlobalCommandPalette";
import { GlobalQuickAddDialog } from "@/features/tasks/GlobalQuickAddDialog";
import { GlobalNavigationShortcuts } from "@/features/command-palette/GlobalNavigationShortcuts";
import { FocusTimerWidget } from "@/features/tasks/FocusTimerWidget";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");

  const [user] = await db
    .select({ onboardingCompleted: users.onboardingCompleted })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.onboardingCompleted) redirect("/onboarding");

  return (
    <Providers>
      <SidebarProvider>
        <div className="flex h-screen w-full overflow-hidden">
          <SystemsSidebar
            userName={session.user.name}
            userEmail={session.user.email}
            userImage={session.user.image}
          />
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <MobileHeader />
            <main className="flex-1 overflow-y-auto bg-background pb-16 md:pb-0">
              {children}
            </main>
            <BottomNav />
          </div>
        </div>
      </SidebarProvider>
      <GlobalCommandPalette />
      <GlobalQuickAddDialog />
      <GlobalNavigationShortcuts />
      <FocusTimerWidget />
      <InstallPrompt />
    </Providers>
  );
}
