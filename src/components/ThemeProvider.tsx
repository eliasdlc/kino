"use client";

import { create } from "zustand";
import { useEffect } from "react";

type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

/**
 * Zustand store for theme persistence.
 * Reads initial value from localStorage, writes back on change.
 * The actual class toggling happens in the ThemeProvider component via useEffect.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  mode: "system",
  setMode: (mode) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kino-theme", mode);
    }
    set({ mode });
  },
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
 * ThemeProvider must be rendered once in the app tree (inside Providers).
 * Handles:
 * 1. Reading initial theme from localStorage on mount
 * 2. Applying the dark class to <html>
 * 3. Listening for OS preference changes when mode === "system"
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("kino-theme") as ThemeMode | null;
    if (stored && ["light", "dark", "system"].includes(stored)) {
      setMode(stored);
    }
  }, [setMode]);

  // Apply class and listen for OS changes
  useEffect(() => {
    applyThemeClass(mode);

    if (mode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeClass("system");
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [mode]);

  return <>{children}</>;
}
