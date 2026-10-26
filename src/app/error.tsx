"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { PageError } from "@/components/PageError";

// Boundary raíz: cualquier error que no atrape un boundary más cercano cae
// aquí, dentro del layout raíz. Ninguna pantalla puede tumbar la app entera.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { layer: "root-boundary" } });
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-background text-foreground">
      <PageError
        title="Esto no se pudo abrir"
        voz="No perdiste nada. Vuelve a intentarlo o pasa a Hoy."
        reset={reset}
        digest={error.digest}
      />
    </div>
  );
}
