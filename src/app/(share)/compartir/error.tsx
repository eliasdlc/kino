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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 pt-[max(1.25rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))]">
      <header className="space-y-2">
        <h1 className="font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.03em]">No se pudo abrir</h1>
        <p className="font-voice text-[1.06rem] italic leading-snug text-body">
          Lo que compartiste sigue guardado en el teléfono y aparecerá en Bandeja. No se perdió.
        </p>
      </header>
      <div className="mt-auto space-y-2">
        <Button size="lg" onClick={reset} className="w-full text-base">
          Reintentar
        </Button>
        <Button asChild size="lg" variant="secondary" className="w-full text-base">
          <Link href="/bandeja">Abrir Bandeja</Link>
        </Button>
      </div>
    </main>
  );
}
