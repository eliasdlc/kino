import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import { serverQuery } from "@/shared/convex/server";
import { Providers } from "./providers";
import { accountThemeScript } from "@/shared/lib/theme-script";
import { SystemsSidebar, type CuentaDelSidebar } from "@/features/systems/SystemsSidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { BottomNav } from "@/components/BottomNav";
import { AppMain } from "@/components/AppMain";
import { InstallPrompt } from "@/components/InstallPrompt";
import { OfflineIndicator } from "@/features/offline/OfflineIndicator";

import { GlobalCommandPaletteLazy } from "@/features/command-palette/GlobalCommandPaletteLazy";
import { GlobalQuickAddDialogLazy } from "@/features/tasks/GlobalQuickAddDialogLazy";
import { GlobalNavigationShortcuts } from "@/features/command-palette/GlobalNavigationShortcuts";
import { FocusTimerProvider } from "@/features/tasks/FocusTimerProvider";
import { FocusTimerWidget } from "@/features/tasks/FocusTimerWidget";
import { FocusTimerModeDialog } from "@/features/tasks/FocusTimerModeDialog";
import { getServerSession } from "@/shared/utils/session";
import { AnalyticsIdentity } from "@/shared/observability/AnalyticsIdentity";
import { ActiveSince } from "@/features/account/ActiveSince";
import { MantenerAvisos } from "@/features/notifications/MantenerAvisos";

/**
 * El shell de la app. Antes de emitir nada espera la sesión (una cookie) y una
 * sola vuelta con las dos lecturas en paralelo: la fila de `users` y los
 * ajustes. La fila decide si la persona termina el onboarding antes de ver
 * ninguna pantalla, y el tema tiene que conocerse antes de la primera pintura
 * o un dispositivo estrenado da un destello. Cada página llega en streaming
 * detrás de su `loading.tsx`, así que la cabecera, el pie y el sidebar se
 * pintan antes que los datos de cualquier pantalla.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  // El onboarding y el tema salen de la misma vuelta.
  const [user, settings] = await Promise.all([
    serverQuery(api.users.current, {}),
    serverQuery(api.settings.get, {}),
  ]);
  if (!user.onboardingCompleted) redirect("/onboarding");
  const theme = settings.theme ?? "system";

  const cuenta: CuentaDelSidebar = { name: user.name, email: user.email, image: user.image ?? null };

  return (
    <Providers initialTheme={theme}>
      {/* Antes que `children`: sus efectos corren en ese orden, así que la
          persona ya está identificada cuando la pantalla de debajo dispara su
          primer evento del funnel. */}
      <AnalyticsIdentity userId={user._id} />
      {/* Deja constancia de que la cuenta sigue viva; como mucho una vez al día. */}
      <ActiveSince />
      {/* Rehace la suscripción push de este dispositivo si caducó o cambió de clave. */}
      <MantenerAvisos />
      {/* Aplica el tema de la cuenta antes de la primera pintura cuando este
          dispositivo todavía no tiene uno propio. Ver `theme-script`. */}
      <script dangerouslySetInnerHTML={{ __html: accountThemeScript(theme) }} />
      <FocusTimerProvider>
        <div className="flex h-dvh w-full overflow-hidden">
          <SystemsSidebar cuenta={cuenta} />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <MobileHeader />
            <AppMain>{children}</AppMain>
            <BottomNav />
          </div>
        </div>
        <GlobalCommandPaletteLazy />
        <GlobalQuickAddDialogLazy />
        <GlobalNavigationShortcuts />
        <FocusTimerWidget />
        <FocusTimerModeDialog />
        <InstallPrompt />
        <OfflineIndicator />
      </FocusTimerProvider>
    </Providers>
  );
}

