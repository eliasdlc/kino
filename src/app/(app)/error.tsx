"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { PageError } from "@/components/PageError";

// Boundary del grupo autenticado: un error dentro de una pantalla cae aquí
// conservando el shell (sidebar, cabecera, pie); el reset reintenta sólo esa
// pantalla, no toda la app.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { layer: "app-boundary" } });
    console.error(error);
  }, [error]);

  return (
    <PageError
      title="Esta pantalla no se pudo abrir"
      voz="El resto sigue en su sitio y no perdiste nada. Vuelve a intentarlo o pasa a Hoy."
      reset={reset}
      digest={error.digest}
    />
  );
}
