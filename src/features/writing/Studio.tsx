"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  PenLine,
  Scissors,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { EntityFicheSheet } from "@/features/entities/EntityFicheSheet";
import { useStudio } from "./writing.hooks";
import type { Suggestion, SuggestionKind } from "./studio";

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

export function Studio({ systemId }: { systemId: string }) {
  const { data, isLoading } = useStudio(systemId);
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const suggestions = data?.suggestions ?? [];
  const gaps = data?.codexGaps ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Qué escribir hoy</h2>
          <p className="text-xs text-muted-foreground">
            Derivado de tus sesiones y tu texto. Sin IA.
          </p>
        </div>

        {suggestions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <CheckCircle2 className="mx-auto size-7 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium">Nada que señalar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ninguna obra parada, ningún capítulo a medias y ningún hilo suelto.
              Escribe lo que te apetezca.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((suggestion) => (
              <SuggestionRow
                key={suggestion.kind}
                suggestion={suggestion}
                systemId={systemId}
              />
            ))}
          </ul>
        )}
      </section>

      {gaps.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Fichas por escribir</h2>
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
                  className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className="min-w-0 max-w-full flex-1 truncate text-sm font-medium">
                    {gap.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
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

function SuggestionRow({
  suggestion,
  systemId,
}: {
  suggestion: Suggestion;
  systemId: string;
}) {
  const Icon = ICON[suggestion.kind];
  const href = targetHref(suggestion, systemId);

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
          className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border bg-card p-3">{body}</div>
      )}
    </li>
  );
}

function targetHref(suggestion: Suggestion, systemId: string): string | null {
  const target = suggestion.target;
  if (!target) return null;
  if (target.kind === "page") return `/systems/${systemId}/pages/${target.id}`;
  if (target.kind === "folder") return `/systems/${systemId}/folders/${target.id}`;
  return `/systems/${systemId}/codex?view=hilos`;
}
