"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

/**
 * Celebración discreta (PLAN-11 §3.6): un momento visual sobrio, con icono
 * lucide y sin emojis. Terminar un capítulo o cruzar una meta merece que se
 * note; no merece confetti.
 */
export function celebrate({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
}) {
  toast.custom(
    () => (
      <div className="flex w-80 items-start gap-3 rounded-xl border bg-card p-4 shadow-lg">
        <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
    ),
    { duration: 6000 },
  );
}

const STORAGE_PREFIX = "kino-writing-celebrated:";

/**
 * Celebrar una vez y nunca más. La marca vive en localStorage porque el hito es
 * derivado: cruzar la meta se vuelve a "detectar" en cada carga de la obra, y
 * repetir la celebración cada vez la convertiría en ruido.
 *
 * Devuelve una función que dispara la celebración solo la primera vez para esa
 * clave. En SSR o con storage bloqueado no celebra en vez de reventar.
 */
export function useCelebrateOnce() {
  const firedThisSession = useRef(new Set<string>());

  return useCallback(
    (key: string, payload: Parameters<typeof celebrate>[0]) => {
      if (firedThisSession.current.has(key)) return;
      firedThisSession.current.add(key);

      const storageKey = `${STORAGE_PREFIX}${key}`;
      try {
        if (localStorage.getItem(storageKey)) return;
        localStorage.setItem(storageKey, "1");
      } catch {
        return;
      }
      celebrate(payload);
    },
    [],
  );
}
