"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/features/notifications/notifications.hooks";

const DISMISSED_KEY = "kino-notif-prompt-dismissed";

/**
 * Una línea al pie de Hoy, no una tarjeta antes de la cifra: pide activar los
 * recordatorios y se va con la X o con el permiso concedido.
 */
export function NotificationPromptCard() {
  const { status, subscribe } = usePushNotifications();
  // useSyncExternalStore guarantees SSR/Hydration returns false, and client post-hydration returns true.
  // This cleanly avoids both hydration mismatches and React Compiler's set-state-in-effect errors.
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DISMISSED_KEY) === "true";
  });

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  // Only show when fully mounted on client, push is available but not yet activated
  if (!isClient || status !== "idle" || dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <Bell className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 text-sm text-foreground/80">
        Un aviso antes de que venza una tarea, incluso sin la app abierta.
      </p>
      <Button variant="link" size="sm" className="h-auto px-0" onClick={subscribe}>
        Activar
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={dismiss} aria-label="Descartar">
        <X className="size-4" />
      </Button>
    </div>
  );
}
