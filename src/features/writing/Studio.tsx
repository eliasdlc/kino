"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Flame,
  PenLine,
  Scissors,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { EntityFicheSheet } from "@/features/entities/EntityFicheSheet";
import { SuggestionList, type SuggestionEmptyState } from "@/shared/suggestions/SuggestionList";
import { useStudio } from "./writing.hooks";
import type { SuggestionKind, WritingSuggestion } from "./studio";

/**
 * El estudio (KIN-143): la inteligencia de escritura dentro de la app, sin LLM.
 *
 * Cada sugerencia enseña el dato del que sale. Esa es toda la diferencia entre
 * una señal y una corazonada, y es la promesa del proyecto: inteligencia real
 * que no miente. Nada de esto se inventa nada: sale de sesiones, menciones y
 * capítulos que Kino ya tenía.
 */

const ICON: Record<SuggestionKind, LucideIcon> = {
  "resume-chapter": PenLine,
  "stale-work": Clock,
  "daily-goal": Target,
  "peak-window": Flame,
  "loose-threads": Scissors,
  "first-step": Sparkles,
};

/**
 * Hay datos y ninguna regla llegó a su umbral. No es lo mismo que un sistema sin
 * empezar, que aquí no puede pasar: sin un solo capítulo, las reglas proponen el
 * primer paso en vez de devolver la lista vacía.
 */
const NADA_QUE_SENALAR: SuggestionEmptyState = {
  icon: CheckCircle2,
  title: "Nada que señalar",
  description:
    "Ninguna obra parada, ningún capítulo a medias y ningún hilo suelto. Escribe lo que te apetezca.",
};

export function Studio({ systemId }: { systemId: string }) {
  const { data, isLoading } = useStudio(systemId);
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-40 rounded-md bg-muted" />
        <div className="h-16 w-full rounded-xl bg-muted" />
      </div>
    );
  }

  const suggestions = data?.suggestions ?? [];
  const gaps = data?.codexGaps ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <h2 className="text-[1.06rem] font-bold tracking-[-0.01em]">Qué escribir hoy</h2>
          <p className="text-xs text-muted-foreground">
            Derivado de tus sesiones y tu texto. Sin IA.
          </p>
        </div>

        <SuggestionList<WritingSuggestion>
          suggestions={suggestions}
          quiet={NADA_QUE_SENALAR}
          iconFor={(suggestion) => ICON[suggestion.kind]}
          hrefFor={(suggestion) => targetHref(suggestion, systemId)}
        />
      </section>

      {gaps.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[1.06rem] font-bold tracking-[-0.01em]">Fichas por escribir</h2>
          <p className="text-xs text-muted-foreground">
            Aparecen en el texto y no tienen ni una línea que las describa. Es el
            hueco de continuidad más barato de tapar.
          </p>
          <ul className="space-y-1.5">
            {gaps.map((gap) => (
              <li key={gap.entityId}>
                {/* min-h-11: el mínimo táctil. Con una sola línea de texto se
                    quedaba en unos 40px, y en un teléfono el nombre y el recuento
                    no caben en la misma fila, así que se apilan hasta sm. */}
                <button
                  type="button"
                  onClick={() => setOpenEntityId(gap.entityId)}
                  className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className="min-w-0 max-w-full flex-1 truncate text-sm font-medium">
                    {gap.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {gap.mentions} menciones · {gap.chapters}{" "}
                    {gap.chapters === 1 ? "capítulo" : "capítulos"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <EntityFicheSheet
        entityId={openEntityId}
        systemId={systemId}
        open={openEntityId !== null}
        onOpenChange={(o) => !o && setOpenEntityId(null)}
      />
    </div>
  );
}

function targetHref(suggestion: WritingSuggestion, systemId: string): string | null {
  const target = suggestion.target;
  if (!target) return null;
  if (target.kind === "page") return `/systems/${systemId}/pages/${target.id}`;
  if (target.kind === "folder") return `/systems/${systemId}/folders/${target.id}`;
  return `/systems/${systemId}/codex?view=hilos`;
}
