import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { users, userSettings } from "@/shared/db/schema";
import { Providers } from "./providers";
import { accountThemeScript } from "@/shared/lib/theme-script";
import { SystemsSidebar } from "@/features/systems/SystemsSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { BottomNav } from "@/components/BottomNav";
import { InstallPrompt } from "@/components/InstallPrompt";
import { OfflineIndicator } from "@/features/offline/OfflineIndicator";

import { GlobalCommandPalette } from "@/features/command-palette/GlobalCommandPalette";
import { GlobalQuickAddDialog } from "@/features/tasks/GlobalQuickAddDialog";
import { GlobalNavigationShortcuts } from "@/features/command-palette/GlobalNavigationShortcuts";
import { FocusTimerProvider } from "@/features/tasks/FocusTimerProvider";
import { FocusTimerWidget } from "@/features/tasks/FocusTimerWidget";
import { FocusTimerModeDialog } from "@/features/tasks/FocusTimerModeDialog";
import { getServerSession } from "@/shared/utils/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) redirect("/login");

  // El tema sale en la misma consulta que el onboarding: el layout ya viajaba
  // a la base y así el dispositivo estrenado no necesita un fetch después.
  const [user] = await db
    .select({
      onboardingCompleted: users.onboardingCompleted,
      theme: userSettings.theme,
    })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.onboardingCompleted) redirect("/onboarding");

  const theme = user.theme ?? "system";

  return (
    <Providers initialTheme={theme}>
      {/* Aplica el tema de la cuenta antes de la primera pintura cuando este
          dispositivo todavía no tiene uno propio. Ver `theme-script`. */}
      <script dangerouslySetInnerHTML={{ __html: accountThemeScript(theme) }} />
      <FocusTimerProvider>
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
        <FocusTimerModeDialog />
        <InstallPrompt />
        <OfflineIndicator />
      </FocusTimerProvider>
    </Providers>
  );
}
