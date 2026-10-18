"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { PageError } from "@/components/PageError";

// Boundary del alta: la cuenta ya existe cuando se llega aquí, así que
// reintentar vuelve a la única pregunta sin perder nada.
export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { layer: "onboarding-boundary" } });
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-background text-foreground">
      <PageError
        title="El alta no se pudo abrir"
        voz="Tu cuenta ya existe. Vuelve a intentarlo y sigues donde estabas."
        reset={reset}
        digest={error.digest}
        volver={null}
      />
    </div>
  );
}
