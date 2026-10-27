"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Reintentar de verdad: vuelve a pedir la pantalla que falló, que es la que
 * está en la barra de direcciones (el service worker sirve esta página en su
 * lugar sin cambiar la URL). Sin red no recarga para nada: lo dice y espera.
 * Antes era un enlace a Hoy, que sin red volvía a fallar.
 */
export function Reintentar() {
  const [sinRed, setSinRed] = useState(false);

  function reintentar() {
    if (!navigator.onLine) {
      setSinRed(true);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="space-y-2">
      <Button size="lg" className="w-full text-base" onClick={reintentar}>
        Reintentar
      </Button>
      <p role="status" className="min-h-[1.5em] text-center text-sm text-muted-foreground">
        {sinRed ? "Todavía no hay red. Vuelve a intentarlo cuando la haya." : ""}
      </p>
    </div>
  );
}
