import type { ReactNode } from "react";

/**
 * El grupo de compartir vive fuera del grupo de la app. El layout de la app
 * monta once piezas globales antes de pintar nada y resuelve la sesión con un
 * redirect, y esta pantalla tiene que abrir antes de que el dedo se arrepienta.
 * La sesión se resuelve dentro de la pantalla, no en la puerta.
 */
export default function ShareLayout({ children }: { children: ReactNode }) {
  return <div className="bg-background text-foreground">{children}</div>;
}
