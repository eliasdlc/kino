"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Pin } from "lucide-react";
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
  pinnedIds = [],
  onTogglePin,
}: {
  pageId: string;
  systemId: string;
  /** Ids ya fijados en la mesa de referencias (W4); vacío si la obra no aplica. */
  pinnedIds?: string[];
  onTogglePin?: (entityId: string) => void;
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
            const pinned = pinnedIds.includes(e.id);
            return (
              <li key={e.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => setOpenEntityId(e.id)}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/50",
                  )}
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {e.mentionCount}×
                  </span>
                </button>
                {onTogglePin && (
                  <button
                    type="button"
                    onClick={() => onTogglePin(e.id)}
                    aria-pressed={pinned}
                    aria-label={pinned ? `Quitar ${e.name} de la mesa` : `Fijar ${e.name} en la mesa`}
                    className={cn(
                      "ml-0.5 shrink-0 rounded p-1 transition-colors hover:text-foreground",
                      pinned
                        ? "text-primary"
                        : "text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100",
                    )}
                  >
                    <Pin className="size-3" />
                  </button>
                )}
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
