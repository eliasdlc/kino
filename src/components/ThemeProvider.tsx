"use client";

import { create } from "zustand";
import { useEffect } from "react";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "kino-theme";
const MODES: readonly ThemeMode[] = ["light", "dark", "system"];

function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && MODES.includes(value as ThemeMode);
}

interface ThemeState {
  mode: ThemeMode;
  /** false hasta saber qué tema eligió este dispositivo. */
  hydrated: boolean;
  /** Elección explícita: se persiste en este dispositivo. */
  setMode: (mode: ThemeMode) => void;
  /** Valor ya conocido: se adopta sin volver a escribirlo. */
  hydrate: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "system",
  hydrated: false,
  setMode: (mode) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, mode);
    }
    set({ mode, hydrated: true });
  },
  hydrate: (mode) => set({ mode, hydrated: true }),
}));

function applyThemeClass(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
  } else {
    root.classList.toggle("dark", mode === "dark");
  }
}

/**
 * Se renderiza una vez en el árbol de la app, dentro de Providers.
 *
 * La clase `dark` de la primera pintura no la pone este componente sino los
 * scripts inline de `shared/lib/theme-script`: un efecto siempre corre después
 * de pintar y produciría un destello. Aquí sólo se mantiene sincronizada a
 * partir de ese punto: cambios del usuario y cambios del tema del SO.
 *
 * `initialTheme` es el tema guardado en la cuenta, que el layout de `(app)`
 * lee del servidor. Sólo se usa si este dispositivo no tiene elección propia.
 */
export function ThemeProvider({
  initialTheme = "system",
  children,
}: {
  initialTheme?: ThemeMode;
  children: React.ReactNode;
}) {
  const mode = useThemeStore((s) => s.mode);
  const hydrated = useThemeStore((s) => s.hydrated);
  const setMode = useThemeStore((s) => s.setMode);
  const hydrate = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemeMode(stored)) {
      hydrate(stored);
      return;
    }
    // Dispositivo estrenado: el tema de la cuenta pasa a ser el suyo, para que
    // el script del layout raíz lo resuelva solo en la siguiente carga.
    setMode(initialTheme);
  }, [initialTheme, hydrate, setMode]);

  useEffect(() => {
    if (!hydrated) return;
    applyThemeClass(mode);

    if (mode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeClass("system");
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [mode, hydrated]);

  return <>{children}</>;
}
