"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";
import { rootThemeScript } from "@/shared/lib/theme-script";

/**
 * El último boundary (KIN-164).
 *
 * `error.tsx` y el del grupo `(app)` cubren todo lo que pasa *dentro* del layout
 * raíz. Cuando el que falla es el layout raíz, no queda ninguno: React desmonta
 * el árbol entero y Next enseña su pantalla genérica, en inglés y sin salida.
 * Este componente la sustituye, y por eso trae su propio `html` y su `body`.
 *
 * Es un caso raro, y justo por eso el que más desconcierta: no hay sidebar, no
 * hay navegación, no hay nada. Lo mínimo honesto es decir qué pasó en el idioma
 * de la app y dejar dos salidas.
 *
 * Se escribe deliberadamente sin componentes compartidos ni `next/link`: si el
 * layout raíz reventó, apoyarse en más piezas de la app es apostar a que la que
 * falló no era una de ellas. Un `<a>` y un `<button>` funcionan igual.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El único sitio donde Next no reporta por su cuenta: el árbol ya no existe.
    Sentry.captureException(error, { tags: { layer: "global-error" } });
    console.error(error);
  }, [error]);

  return (
    <html lang="es" suppressHydrationWarning className="h-full antialiased">
      <head>
        {/* Sin el layout raíz nadie aplica el tema, y quien usa la app en
            oscuro recibiría una pantalla blanca de golpe. */}
        <script dangerouslySetInnerHTML={{ __html: rootThemeScript }} />
      </head>
      <body className="min-h-full">
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-24 text-center">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Algo se rompió</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Kino no pudo cargar
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              No perdiste nada de lo que habías guardado. Puedes reintentar o
              volver al inicio.
            </p>
            {error.digest && (
              // El identificador que Sentry y los logs comparten: es lo que
              // convierte un "no me carga" en algo que se puede buscar.
              <p className="pt-2 font-mono text-xs text-muted-foreground/70">
                Referencia: {error.digest}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Reintentar
            </button>
            {/* Un `<a>` y no un `<Link>`: `Link` navega por el router del
                cliente, y aquí el árbol de React acaba de morir. Lo que hace
                falta es que el navegador pida la página otra vez desde cero. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
