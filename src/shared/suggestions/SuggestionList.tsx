"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import type { Suggestion } from "./types";

/**
 * La lista de sugerencias con sus dos estados vacíos.
 *
 * Los dos estados son la parte que normalmente nadie escribe, y son distintos a
 * propósito: **todavía no hay nada que medir** no es lo mismo que **hay datos y
 * ninguno llegó al umbral**. Confundirlos hace que un sistema recién creado
 * parezca roto y que uno tranquilo parezca vacío.
 *
 * Cada fila enseña el dato del que sale, siempre visible. Sin la razón al lado
 * esto sería una corazonada, y una corazonada no se puede ir a verificar.
 */

export interface SuggestionEmptyState {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface SuggestionListProps<TSuggestion extends Suggestion> {
  suggestions: readonly TSuggestion[];
  /**
   * Lo que se pinta cuando el sistema todavía no tiene nada que medir. Sin él,
   * ese caso cae en `quiet`, que dice lo contrario de lo que pasa.
   */
  unstarted?: SuggestionEmptyState;
  /** Lo que se pinta cuando hay datos y ninguna regla llegó a su umbral. */
  quiet: SuggestionEmptyState;
  /** El slice decide qué señal significa «todavía no hay nada que medir». */
  isUnstarted?: boolean;
  iconFor: (suggestion: TSuggestion) => LucideIcon;
  /** A dónde lleva cada fila, o `null` si esa sugerencia no lleva a ningún sitio. */
  hrefFor?: (suggestion: TSuggestion) => string | null;
}

export function SuggestionList<TSuggestion extends Suggestion>({
  suggestions,
  unstarted,
  quiet,
  isUnstarted = false,
  iconFor,
  hrefFor,
}: SuggestionListProps<TSuggestion>) {
  if (suggestions.length === 0) {
    return <EmptyState state={isUnstarted && unstarted ? unstarted : quiet} />;
  }

  return (
    <ul className="space-y-2">
      {suggestions.map((suggestion) => (
        <SuggestionRow
          key={suggestion.kind}
          suggestion={suggestion}
          Icon={iconFor(suggestion)}
          href={hrefFor?.(suggestion) ?? null}
        />
      ))}
    </ul>
  );
}

function EmptyState({ state }: { state: SuggestionEmptyState }) {
  const { icon: Icon, title, description } = state;
  // Movido tal cual desde el estudio, `items-center` y los dos párrafos hermanos
  // incluidos, para que esta extracción no cambie nada de lo que se ve. El
  // `mt-1` del segundo no hace nada dentro de una fila y los dos textos salen
  // lado a lado: se arregla con su captura en el mini cerebro, que es donde
  // este estado vacío se usa de verdad por primera vez.
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function SuggestionRow<TSuggestion extends Suggestion>({
  suggestion,
  Icon,
  href,
}: {
  suggestion: TSuggestion;
  Icon: LucideIcon;
  href: string | null;
}) {
  const body = (
    <>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{suggestion.title}</p>
        {/* El porqué siempre visible: sin el dato, esto sería una corazonada. */}
        <p className="mt-0.5 text-sm text-muted-foreground">{suggestion.reason}</p>
      </div>
      {href && <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
    </>
  );

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent/40"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
          {body}
        </div>
      )}
    </li>
  );
}
