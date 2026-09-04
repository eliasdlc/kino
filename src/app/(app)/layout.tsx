import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { serverMutation, serverQuery } from "@/shared/convex/server";
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
import { AnalyticsIdentity } from "@/shared/observability/AnalyticsIdentity";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  // `ensure` crea el documento de la persona la primera vez que entra; después
  // el tema y el onboarding salen de la misma lectura.
  await serverMutation(api.users.ensure, {});
  const [user, settings] = await Promise.all([
    serverQuery(api.users.current, {}),
    serverQuery(api.settings.get, {}),
  ]);

  if (!user.onboardingCompleted) redirect("/onboarding");

  const theme = settings.theme ?? "system";

  return (
    <Providers initialTheme={theme}>
      {/* Antes que `children`: sus efectos corren en ese orden, así que la
          persona ya está identificada cuando la pantalla de debajo dispara su
          primer evento del funnel. */}
      <AnalyticsIdentity userId={user._id} />
      {/* Aplica el tema de la cuenta antes de la primera pintura cuando este
          dispositivo todavía no tiene uno propio. Ver `theme-script`. */}
      <script dangerouslySetInnerHTML={{ __html: accountThemeScript(theme) }} />
      <FocusTimerProvider>
        <SidebarProvider>
          <div className="flex h-screen w-full overflow-hidden">
            <SystemsSidebar
              userName={user.name}
              userEmail={user.email}
              userImage={user.image ?? null}
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
