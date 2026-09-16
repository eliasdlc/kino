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
    <ul className="space-y-2">
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
 * Un estado vacío es una fila más, así que se compone igual que una: el icono a
 * la izquierda y los dos textos apilados a su derecha. Puestos como hermanos
 * dentro de la misma fila salían uno al lado del otro.
 */
function EmptyState({ state }: { state: SuggestionEmptyState }) {
  const { icon: Icon, title, description } = state;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/** La caja de una fila, igual lleve a algún sitio o no. */
const ROW = "flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left";
const ROW_ACTIVA = `${ROW} transition-colors hover:bg-accent/40`;

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
  const body = (
    <>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{suggestion.title}</p>
        {/* El porqué siempre visible: sin el dato, esto sería una corazonada. */}
        <p className="mt-0.5 text-sm text-muted-foreground">{suggestion.reason}</p>
      </div>
      {lleva && <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
    </>
  );

  return (
    <li>
      {href !== null ? (
        <Link href={href} className={ROW_ACTIVA}>
          {body}
        </Link>
      ) : onSelect ? (
        <button type="button" onClick={onSelect} className={ROW_ACTIVA}>
          {body}
        </button>
      ) : (
        <div className={ROW}>{body}</div>
      )}
    </li>
  );
}
