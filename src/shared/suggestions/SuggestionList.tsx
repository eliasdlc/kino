"use client";

import { ArrowRight, type LucideIcon } from "lucide-react";
import { MarginRow } from "@/components/ui/margin-row";
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
  /**
   * Qué hacer al pulsar una fila que no tiene URL. Existe porque no todo lo que
   * una sugerencia señala se abre navegando: una tarea se abre en su hoja y no
   * tiene ruta propia. Con `hrefFor` la fila es un enlace, con esto un botón, y
   * sin ninguno de los dos no es pulsable.
   */
  onSelect?: (suggestion: TSuggestion) => void;
}

export function SuggestionList<TSuggestion extends Suggestion>({
  suggestions,
  unstarted,
  quiet,
  isUnstarted = false,
  iconFor,
  hrefFor,
  onSelect,
}: SuggestionListProps<TSuggestion>) {
  if (suggestions.length === 0) {
    return <EmptyState state={isUnstarted && unstarted ? unstarted : quiet} />;
  }

  return (
    <ul>
      {suggestions.map((suggestion) => (
        <SuggestionRow
          key={suggestion.kind}
          suggestion={suggestion}
          Icon={iconFor(suggestion)}
          href={hrefFor?.(suggestion) ?? null}
          onSelect={onSelect && (() => onSelect(suggestion))}
        />
      ))}
    </ul>
  );
}

/**
 * Un estado vacío es una fila más, así que se compone igual que una: el icono
 * en el margen y los dos textos apilados en la columna de texto. Puestos como
 * hermanos dentro de la misma fila salían uno al lado del otro.
 */
function EmptyState({ state }: { state: SuggestionEmptyState }) {
  const { icon: Icon, title, description } = state;
  return (
    <MarginRow margin={<Icon aria-hidden className="size-5" />}>
      <span className="block text-base font-medium text-foreground">{title}</span>
      <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
    </MarginRow>
  );
}

/**
 * Una sugerencia es una fila de margen de Diario: el glifo en el margen, el
 * título y su razón en la columna de texto y la flecha en la cola si lleva a
 * algún sitio. Las filas se separan con un hairline, sin caja. La fila es un
 * enlace con `href`, un botón con `onSelect` y un renglón quieto sin ninguno.
 */
function SuggestionRow<TSuggestion extends Suggestion>({
  suggestion,
  Icon,
  href,
  onSelect,
}: {
  suggestion: TSuggestion;
  Icon: LucideIcon;
  href: string | null;
  onSelect?: () => void;
}) {
  const lleva = href !== null || onSelect !== undefined;
  return (
    <li className="border-b border-border last:border-b-0">
      <MarginRow
        href={href ?? undefined}
        onClick={href === null ? onSelect : undefined}
        className="border-b-0"
        margin={<Icon aria-hidden className="size-5" />}
        trailing={lleva ? <ArrowRight aria-hidden className="size-4" /> : undefined}
      >
        <span className="block text-base font-medium text-foreground">{suggestion.title}</span>
        {/* El porqué siempre visible: sin el dato, esto sería una corazonada. */}
        <span className="mt-0.5 block text-sm text-muted-foreground">{suggestion.reason}</span>
      </MarginRow>
    </li>
  );
}
