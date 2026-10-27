"use client";

import { usePathname } from "next/navigation";

/**
 * Pasar página: la pantalla nueva entra desde la derecha en `--dur-pagina`
 * con pluma, sólo transform y opacity. Sólo entrada: el App Router desmonta
 * la página que sale, así que la salida no se puede animar con CSS. La clave
 * es la ruta, para que cada navegación vuelva a pasar la página; el bloque de
 * reduced motion de globals.css la apaga.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="anim-entrar-pagina min-h-full">
      {children}
    </div>
  );
}
