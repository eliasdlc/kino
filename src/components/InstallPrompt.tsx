"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "kino-install-prompt-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === "true") return;

    // PWA is already installed — don't show
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    function handler(e: Event) {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-30 rounded-xl border bg-card shadow-lg p-4 flex items-start gap-3">
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium">Instalar Kino</p>
        <p className="text-xs text-muted-foreground">
          Agrégalo a tu pantalla de inicio para acceso rápido y notificaciones.
        </p>
        <Button size="sm" className="mt-2 h-8 text-xs gap-1.5" onClick={handleInstall}>
          <Download className="size-3.5" />
          Instalar
        </Button>
      </div>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Descartar"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
