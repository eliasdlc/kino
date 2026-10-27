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
import { MarginRow } from "@/components/ui/margin-row";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHead } from "@/features/dashboard/SectionHead";
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
    // La forma de lo que llega: un encabezado con su hairline y dos filas.
    return (
      <div aria-busy className="space-y-2">
        <div className="border-b border-border pb-2">
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-[3.4rem] w-full rounded-md" />
        <Skeleton className="h-[3.4rem] w-full rounded-md" />
      </div>
    );
  }

  const suggestions = data?.suggestions ?? [];
  const gaps = data?.codexGaps ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <SectionHead title="Qué escribir hoy" />
        <p className="text-sm text-muted-foreground">
          Sale de tus sesiones y de tu texto, sin IA que lo adivine: cada señal dice de dónde.
        </p>

        <SuggestionList<WritingSuggestion>
          suggestions={suggestions.map(conRazonLegible)}
          quiet={NADA_QUE_SENALAR}
          iconFor={(suggestion) => ICON[suggestion.kind]}
          hrefFor={(suggestion) => targetHref(suggestion, systemId)}
        />
      </section>

      {gaps.length > 0 && (
        <section className="space-y-2">
          <SectionHead
            title="Fichas por escribir"
            count={gaps.length === 1 ? "1 ficha" : `${gaps.length} fichas`}
          />
          <p className="pl-(--margen) text-sm text-muted-foreground">
            Aparecen en el texto y no tienen ni una línea que las describa. Es el
            hueco de continuidad más barato de tapar.
          </p>
          <ul>
            {gaps.map((gap, index) => (
              <li key={gap.entityId} className="border-b border-border last:border-b-0">
                <MarginRow
                  onClick={() => setOpenEntityId(gap.entityId)}
                  className="border-b-0"
                  margin={
                    <span className="font-display text-base font-bold text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                  }
                  trailing={`${gap.mentions} ${gap.mentions === 1 ? "mención" : "menciones"}`}
                >
                  <span className="block truncate text-base font-semibold text-foreground">{gap.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    en {gap.chapters} {gap.chapters === 1 ? "capítulo" : "capítulos"}
                  </span>
                </MarginRow>
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

/**
 * La razón tal como la arma `studio.ts`, también si la arma un despliegue de
 * Convex anterior: aquel separaba con un punto medio y decía «palabras en sin
 * obra». Cuando Convex sirva el texto nuevo esto no cambia nada.
 */
export function conRazonLegible<T extends { reason: string }>(suggestion: T): T {
  const reason = suggestion.reason
    .replace(/\s+\u00b7\s+/g, ": ")
    .replace(/palabras en sin obra/g, "palabras sin obra asignada");
  return reason === suggestion.reason ? suggestion : { ...suggestion, reason };
}

function targetHref(suggestion: WritingSuggestion, systemId: string): string | null {
  const target = suggestion.target;
  if (!target) return null;
  if (target.kind === "page") return `/systems/${systemId}/pages/${target.id}`;
  if (target.kind === "folder") return `/systems/${systemId}/folders/${target.id}`;
  return `/systems/${systemId}/codex?view=hilos`;
}
