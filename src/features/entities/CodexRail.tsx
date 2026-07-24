"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageEntities } from "./entities.hooks";
import { ENTITY_TYPE_ICON } from "./entities.ui";
import { EntityFicheSheet } from "./EntityFicheSheet";

/**
 * Codex rail contextual (PLAN-11 §7): las entidades detectadas en el capítulo
 * abierto (de page_entity_mentions), con acceso a la ficha en un click. Se monta
 * en el panel del editor de escritura.
 */
export function CodexRail({
  pageId,
  systemId,
}: {
  pageId: string;
  systemId: string;
}) {
  const { data: entities = [], isLoading } = usePageEntities(pageId);
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          En este capítulo
        </p>
        <Link
          href={`/systems/${systemId}/codex`}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          title="Biblioteca del universo"
        >
          <BookOpen className="size-3.5" />
          Codex
        </Link>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : entities.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Menciona personajes, lugares u objetos con @ y aparecerán aquí.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {entities.map((e) => {
            const Icon = ENTITY_TYPE_ICON[e.type];
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setOpenEntityId(e.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50",
                  )}
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {e.mentionCount}×
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
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
