import { Suspense } from "react";
import { PageTransition } from "./PageTransition";
import { PageSkeleton } from "./Skeletons";

/**
 * El contenedor del contenido de la app. Reserva abajo lo que ocupa el chrome
 * del teléfono leyendo `--kino-bottom-chrome`, y no un número: el pie, el
 * banner del timer y el área segura suman en la variable, así que cambiar el
 * pie no deja al último elemento de una lista debajo de él. En escritorio la
 * variable vale cero y no reserva nada.
 *
 * La página va dentro de un `Suspense` propio: cada ruta trae su `loading.tsx`
 * con la forma de su pantalla, y este esqueleto genérico sólo pinta si una
 * ruta nueva llega sin el suyo. Así el shell (cabecera, pie, sidebar) se pinta
 * antes que los datos de la página, siempre.
 */
export function AppMain({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto bg-background" style={{ paddingBottom: "var(--kino-bottom-chrome)" }}>
      <Suspense fallback={<PageSkeleton />}>
        <PageTransition>{children}</PageTransition>
      </Suspense>
    </main>
  );
}
