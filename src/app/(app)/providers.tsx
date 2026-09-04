"use client";

import { ThemeProvider, type ThemeMode } from "@/components/ThemeProvider";
import { SystemTypeProvider } from "@/components/SystemTypeProvider";
import { useUnregisterLegacyServiceWorker } from "@/features/offline/service-worker";

export function Providers({
  initialTheme,
  children,
}: {
  /** Tema guardado en la cuenta, para dispositivos sin elección propia. */
  initialTheme: ThemeMode;
  children: React.ReactNode;
}) {
  useUnregisterLegacyServiceWorker();

  return (
    <ThemeProvider initialTheme={initialTheme}>
      <SystemTypeProvider>{children}</SystemTypeProvider>
    </ThemeProvider>
  );
}
