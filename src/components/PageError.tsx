"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * La pantalla de problema de Diario, la misma para todo boundary: un título
 * en display, una frase en la voz que dice qué pasó y qué no se perdió, y
 * dos acciones, reintentar y volver a Hoy. Sin traza: la referencia del error
 * va en mono y en mute, para que quien escriba pueda citarla. El esqueleto y
 * el vacío tienen su propia pieza; esta es sólo para el error.
 */
export function PageError({
  title,
  voz,
  reset,
  digest,
  volver = { href: "/dashboard", label: "Ir a Hoy" },
}: {
  title: string;
  voz: string;
  reset: () => void;
  digest?: string;
  volver?: { href: string; label: string } | null;
}) {
  return (
    <div role="alert" className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-10 md:px-8 md:py-16">
      <div className="space-y-2">
        <h1 className="font-display text-[1.9rem] leading-[1.05] font-bold tracking-[-0.025em]">{title}</h1>
        <p className="font-voice text-base italic leading-snug text-body">{voz}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={reset} className="sm:min-w-40">
          Reintentar
        </Button>
        {volver && (
          <Button size="lg" variant="outline" asChild className="sm:min-w-40">
            <Link href={volver.href}>{volver.label}</Link>
          </Button>
        )}
      </div>
      {digest && (
        <p className="font-mono text-xs text-muted-foreground">Referencia {digest}</p>
      )}
    </div>
  );
}
