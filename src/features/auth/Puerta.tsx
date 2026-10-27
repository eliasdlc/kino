"use client";

import { ClerkLoading } from "@clerk/nextjs";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * La forma del formulario de Clerk mientras su script carga, con sus huecos
 * medidos en 393 px: los dos botones sociales casi pegados, la raya del "o",
 * la etiqueta y el campo, la acción y la línea del pie. Sin esto la columna
 * quedaba vacía bajo el título hasta que Clerk montaba, y con huecos
 * distintos el formulario real cambiaba de forma al llegar.
 */
export function FormularioEsperando() {
  return (
    <div aria-hidden data-slot="puerta-esperando" className="px-0.5 pt-0.5">
      <Skeleton className="h-[2.85rem] w-full rounded-full" />
      <Skeleton className="mt-[0.55rem] h-[2.85rem] w-full rounded-full" />
      <div className="mt-[1.5rem] flex h-[1.1rem] items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <Skeleton className="h-3 w-4" />
        <span className="h-px flex-1 bg-border" />
      </div>
      <Skeleton className="mt-[1.6rem] h-4 w-36" />
      <Skeleton className="mt-2 h-[2.85rem] w-full rounded-full" />
      <Skeleton className="mt-[2rem] h-[2.85rem] w-full rounded-full" />
      <Skeleton className="mx-auto mt-[1.6rem] h-4 w-44" />
    </div>
  );
}

/**
 * La puerta entera mientras Clerk no está: título, frase y la forma del
 * formulario. Es el `fallback` de las páginas de entrar y crear cuenta y lo
 * que enseña el catálogo, así que el primer HTML ya trae el h1.
 */
export function PuertaEsperando({
  titulo,
  voz,
  tituloComo = "h1",
}: {
  titulo: string;
  voz: string;
  /** El catálogo lo baja a h2 para no meter un h1 de más en su página. */
  tituloComo?: "h1" | "h2";
}) {
  return (
    <div className="space-y-6">
      <PuertaEncabezado titulo={titulo} voz={voz} tituloComo={tituloComo} />
      <FormularioEsperando />
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

/** El título y la frase de una puerta, sin Clerk. */
export function PuertaEncabezado({
  titulo,
  voz,
  tituloComo: Titular = "h1",
}: {
  titulo: string;
  voz: string;
  /** El catálogo lo baja a h2 para no meter un h1 de más en su página. */
  tituloComo?: "h1" | "h2";
}) {
  return (
    <header className="space-y-2">
      <Titular className="font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.03em]">{titulo}</Titular>
      <p className="font-voice text-[1.06rem] italic leading-snug text-body">{voz}</p>
    </header>
  );
}
