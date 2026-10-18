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

    // PWA is already installed: don't show
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
    <div className="fixed inset-x-4 bottom-[calc(var(--kino-bottom-chrome)+0.5rem)] z-(--z-overlay) flex items-start gap-2 rounded-xl border border-border bg-card p-4 shadow-(--shadow) md:inset-x-auto md:right-6 md:bottom-6 md:w-80">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-display text-base font-bold tracking-tight">Instalar Kino</p>
        <p className="text-sm text-muted-foreground">
          Agrégalo a tu pantalla de inicio para abrirlo en un toque y recibir avisos.
        </p>
        <Button size="sm" className="mt-2" onClick={handleInstall}>
          <Download className="size-4" />
          Instalar
        </Button>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={handleDismiss} aria-label="Descartar" className="-mt-2 -mr-2 shrink-0 text-muted-foreground">
        <X className="size-5" />
      </Button>
    </div>
  );
}
