"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Boundary raíz: cualquier error no capturado por un boundary más específico
// cae aquí, dentro del root layout. Ninguna vista puede tumbar la app entera.
export default function GlobalError({
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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Algo se rompió</p>
        <h1 className="text-2xl font-semibold tracking-tight">Esta vista tuvo un problema</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          No perdiste nada. Puedes reintentar o volver al inicio.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={reset}>
          <RotateCcw className="size-4" />
          Reintentar
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
