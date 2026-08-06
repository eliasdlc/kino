"use client";

import { cn } from "@/lib/utils";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Bloques de organización del catálogo visual (/system-design).
 *
 * Jerarquía: Section (ancla del TOC) → SubSection (grupo temático) →
 * Specimen (una variante/estado concreto, con etiqueta). La regla es que todo
 * componente se muestre dentro de un Specimen para que cada estado quede
 * nombrado y comparable con sus vecinos.
 */

/**
 * Un QueryClient aislado por specimen, sembrado antes del primer render.
 *
 * Muchos componentes de Kino no reciben datos por props: los sacan del cache de
 * react-query, igual que en la app. Sembrar un cliente propio por specimen es lo
 * que permite enseñar varios estados del *mismo* componente en la misma página,
 * y que lo que se ve salga del mismo cálculo que ve el usuario en vez de una
 * copia de mentira que se le parezca.
 */
export function Seeded({
  seed,
  children,
}: {
  seed: (qc: QueryClient) => void;
  children: ReactNode;
}) {
  const [client] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
    });
    seed(qc);
    return qc;
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const subscribeNoop = () => () => {};

/**
 * Monta solo en el cliente. Algunos componentes deciden qué pintar con la fecha
 * u hora actual; en producción eso nunca corre en SSR porque los datos aún no
 * están en cache, pero aquí sí los sembramos antes del primer render. Sin este
 * guard, el server (en su tz) y el cliente (en la del usuario) pueden discrepar
 * y romper la hidratación — un artefacto del specimen, no del componente.
 */
export function ClientOnly({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return <>{children}</>;
}

export function Section({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string;
  number: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border pt-10 pb-4">
      <div className="mb-8">
        <p className="font-mono text-xs text-muted-foreground">{number}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-12">{children}</div>
    </section>
  );
}

export function SubSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-base font-medium">{title}</h3>
      {description && (
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Caja etiquetada que envuelve una variante/estado concreto de un componente. */
export function Specimen({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  /** Nota corta bajo la etiqueta (p. ej. la prop que produce este estado). */
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        className={cn(
          "flex min-h-24 flex-1 flex-wrap content-center items-center gap-3 rounded-lg border border-dashed border-border bg-card/50 p-4",
          className
        )}
      >
        {children}
      </div>
      <div className="px-1">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {hint && <p className="font-mono text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/** Grid responsivo por defecto para colocar specimens lado a lado. */
export function SpecimenGrid({
  cols = 3,
  children,
}: {
  cols?: 2 | 3 | 4;
  children: ReactNode;
}) {
  const colClasses = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[cols];
  return <div className={cn("grid grid-cols-1 gap-4", colClasses)}>{children}</div>;
}

/** Swatch de un token semántico de color (lee la variable CSS en runtime). */
export function TokenSwatch({
  token,
  usage,
}: {
  /** Nombre de la variable, sin guiones iniciales: "primary", "sidebar-accent"… */
  token: string;
  /** Dónde se usa este token en la app. */
  usage?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
      <div
        className="size-10 shrink-0 rounded-md border border-border/60 shadow-xs"
        style={{ background: `var(--${token})` }}
      />
      <div className="min-w-0">
        <p className="truncate font-mono text-xs font-medium">--{token}</p>
        {usage && <p className="truncate text-[11px] text-muted-foreground">{usage}</p>}
      </div>
    </div>
  );
}
