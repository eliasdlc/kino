import { Suspense } from "react";
import { redirect } from "next/navigation";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
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

type Usuario = FunctionReturnType<typeof api.users.current>;

/**
 * El shell de la app. Sólo dos cosas lo bloquean antes de emitir nada: la
 * sesión (una cookie) y el tema de la cuenta, porque el tema tiene que
 * conocerse antes de la primera pintura o un dispositivo estrenado da un
 * destello. Todo lo demás llega en streaming: la fila de `users` (el
 * onboarding, la identidad de la analítica, el menú de cuenta del sidebar) va
 * detrás de un `Suspense`, y cada página detrás de su `loading.tsx`. Así la
 * cabecera, el pie y el sidebar se pintan antes que los datos de cualquier
 * pantalla.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  // Las dos lecturas salen a la vez; sólo el tema se espera aquí.
  const usuario = serverQuery(api.users.current, {});
  const settings = await serverQuery(api.settings.get, {});
  const theme = settings.theme ?? "system";

  const cuenta: Promise<CuentaDelSidebar> = usuario.then((u) => ({
    name: u.name,
    email: u.email,
    image: u.image ?? null,
  }));

  return (
    <Providers initialTheme={theme}>
      <Suspense fallback={null}>
        <Cuenta usuario={usuario} />
      </Suspense>
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

/**
 * Lo que depende de la fila de `users` y no de la pantalla: quien no terminó
 * el onboarding va al onboarding, y la analítica pone nombre a la persona.
 * Corre en streaming, detrás del shell.
 */
async function Cuenta({ usuario }: { usuario: Promise<Usuario> }) {
  const user = await usuario;
  if (!user.onboardingCompleted) redirect("/onboarding");
  return <AnalyticsIdentity userId={user._id} />;
}
