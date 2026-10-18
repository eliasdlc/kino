"use client";

import { ClerkLoading } from "@clerk/nextjs";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * La forma del formulario de Clerk mientras su script carga: dos botones
 * sociales, la raya del "o", el campo con su etiqueta y la acción. Sin esto la
 * columna quedaba vacía bajo el título hasta que Clerk montaba.
 */
export function FormularioEsperando() {
  return (
    <div aria-hidden data-slot="puerta-esperando" className="space-y-4">
      <Skeleton className="h-[2.85rem] w-full rounded-full" />
      <Skeleton className="h-[2.85rem] w-full rounded-full" />
      <Skeleton className="mx-auto h-3 w-8" />
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-[2.85rem] w-full rounded-full" />
      <Skeleton className="h-[2.85rem] w-full rounded-full" />
    </div>
  );
}

/**
 * Una puerta de Kino (entrar, crear cuenta): el título en Bricolage, la frase
 * del producto en la voz y, debajo, el formulario de Clerk sin card, en el
 * papel. Es lo primero que ve alguien, así que tiene que leerse como Kino y no
 * como el formulario de un proveedor.
 */
export function Puerta({ titulo, voz, children }: { titulo: string; voz: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PuertaEncabezado titulo={titulo} voz={voz} />
      <ClerkLoading>
        <FormularioEsperando />
      </ClerkLoading>
      {children}
    </div>
  );
}

/** El título y la frase de una puerta, sin Clerk: lo que el catálogo enseña. */
export function PuertaEncabezado({ titulo, voz }: { titulo: string; voz: string }) {
  return (
    <header className="space-y-2">
      <h1 className="font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.03em]">{titulo}</h1>
      <p className="font-voice text-[1.06rem] italic leading-snug text-body">{voz}</p>
    </header>
  );
}
