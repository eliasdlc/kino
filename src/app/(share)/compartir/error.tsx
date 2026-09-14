"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * El único error del producto que puede prometer algo: lo compartido ya está
 * guardado en el teléfono antes de que esta pantalla exista, así que aquí se
 * dice dónde quedó en vez de mandar a la pantalla de error de la app.
 */
export default function CompartirError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 p-5">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">No pudimos abrirlo</h1>
        <p className="text-sm text-muted-foreground">
          Lo que compartiste sigue guardado en el teléfono y aparecerá en Bandeja. No se perdió.
        </p>
      </header>
      <div className="space-y-2">
        <Button onClick={reset} className="h-12 w-full rounded-full text-base">
          Reintentar
        </Button>
        <Button asChild variant="secondary" className="h-12 w-full rounded-full text-base">
          <Link href="/bandeja">Abrir Bandeja</Link>
        </Button>
      </div>
    </main>
  );
}
