"use client";

import { useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/features/notifications/notifications.hooks";

const DISMISSED_KEY = "kino-notif-prompt-dismissed";

export function NotificationPromptCard() {
  const { status, subscribe } = usePushNotifications();
  // Lazy initializer reads localStorage only on client, avoids hydration flash
  const [dismissed, setDismissed] = useState(
    () => typeof window === "undefined" || localStorage.getItem(DISMISSED_KEY) === "true"
  );

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  // Only show when push is available but not yet activated
  if (status !== "idle" || dismissed) return null;

  return (
    <div className="relative flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <Bell className="size-5 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-sm font-medium">Activa los recordatorios</p>
        <p className="text-xs text-muted-foreground">
          Kino te avisará antes de que venza una tarea, incluso si no tienes la app abierta.
        </p>
        <Button
          size="sm"
          onClick={subscribe}
          className="h-7 text-xs"
        >
          Activar notificaciones
        </Button>
      </div>
      <button
        onClick={dismiss}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Descartar"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
