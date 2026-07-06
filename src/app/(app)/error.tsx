"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Boundary del grupo autenticado: un error dentro de una vista de la app cae
// aquí conservando el shell (sidebar/nav) del (app)/layout; el reset reintenta
// sólo esta vista, no toda la app.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Algo se rompió</p>
        <h1 className="text-2xl font-semibold tracking-tight">Esta vista tuvo un problema</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          El resto de la app sigue funcionando. Reintenta esta pantalla o vuelve al inicio.
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
