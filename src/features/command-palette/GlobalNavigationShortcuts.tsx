"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useHotkey } from "@/shared/hooks/useHotkey";
import { DESTINOS } from "@/components/navigation";

/** Cuánto espera la `g` a su segunda letra antes de olvidarse. */
const ESPERA_MS = 2000;

/**
 * Los atajos `g` + letra del escritorio: la letra de cada destino sale de la
 * lista única de navegación, la misma que pinta el sidebar y la paleta.
 */
export function GlobalNavigationShortcuts() {
  const router = useRouter();
  const [esperando, setEsperando] = useState(false);

  useHotkey(["g"], (e) => {
    e.preventDefault();
    setEsperando(true);
  });

  useEffect(() => {
    if (!esperando) return;
    const olvidar = window.setTimeout(() => setEsperando(false), ESPERA_MS);

    const segundaTecla = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        setEsperando(false);
        return;
      }
      if (e.key === "g" || e.key === "G") return;

      const destino = DESTINOS.find((d) => d.tecla === e.key.toLowerCase());
      if (destino) {
        e.preventDefault();
        e.stopPropagation();
        router.push(destino.href);
      }
      setEsperando(false);
    };

    window.addEventListener("keydown", segundaTecla, { capture: true });
    return () => {
      window.clearTimeout(olvidar);
      window.removeEventListener("keydown", segundaTecla, { capture: true });
    };
  }, [esperando, router]);

  return null;
}
