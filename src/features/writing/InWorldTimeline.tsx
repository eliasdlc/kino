"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  Hourglass,
  Rewind,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHead } from "@/features/dashboard/SectionHead";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFolders } from "@/features/folders/folders.hooks";
import { EntityFicheSheet } from "@/features/entities/EntityFicheSheet";
import { useReorderTimeline, useTimeline, useUnplaceEvent } from "./writing.hooks";
import { moveWithin, type TimelineEntry } from "./timeline";

/**
 * Cronología in-world (KIN-140): los eventos en el tiempo de la historia, no en
 * el del manuscrito. Lo que se viene a ver es la diferencia entre las dos: un
 * evento marcado como flashback es uno que se cuenta después de algo que pasa
 * más tarde.
 *
 * Se reordena con flechas y no arrastrando: el proyecto no usa drag and drop en
 * touch, y aquí las flechas funcionan igual en los dos sitios.
 */
export function InWorldTimeline({ systemId }: { systemId: string }) {
  const { data: works = [] } = useFolders(systemId);
  const [folderId, setFolderId] = useState<string | null>(null);
  const activeFolderId = folderId ?? works[0]?.id ?? null;
  const { data, isLoading } = useTimeline(activeFolderId);
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);

  const reorder = useReorderTimeline(systemId, activeFolderId ?? "");
  const unplace = useUnplaceEvent(activeFolderId ?? "");

  const placed = data?.placed ?? [];
  const unplaced = data?.unplaced ?? [];

  function move(entityId: string, delta: number) {
    const ids = placed.map((e) => e.entityId);
    const next = moveWithin(ids, entityId, delta);
    if (next === ids) return;
    const byId = new Map(placed.map((e) => [e.entityId, e]));
    reorder.mutate({
      eventIds: next,
      placed: next.map((id, i) => ({ ...byId.get(id)!, order: i + 1 })),
    });
  }

  function place(entry: TimelineEntry) {
    // Se ubica al final: es la posición honesta cuando nadie ha dicho dónde va.
    const ids = [...placed.map((e) => e.entityId), entry.entityId];
    reorder.mutate({
      eventIds: ids,
      placed: [...placed, { ...entry, order: ids.length }],
    });
  }

  if (works.length === 0) {
    return (
      <Empty
        title="Todavía no hay obras"
        hint="La cronología compara el tiempo de la historia con el orden en que se cuenta, así que necesita una obra con capítulos."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={activeFolderId ?? undefined} onValueChange={setFolderId}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Obra">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {works.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          En el orden de la historia; el capítulo dice dónde se cuenta.
        </p>
      </div>

      {isLoading ? (
        <div aria-busy className="space-y-px">
          <Skeleton className="h-[4.6rem] w-full rounded-md" />
          <Skeleton className="h-[4.6rem] w-full rounded-md" />
        </div>
      ) : placed.length === 0 && unplaced.length === 0 ? (
        <Empty
          title="No hay eventos en el codex"
          hint="Crea entidades de tipo Evento (un asedio, una coronación, la noche en que todo cambió) y ordénalas aquí en el tiempo de la historia."
        />
      ) : (
        <>
          {placed.length > 0 && (
            <ol>
              {placed.map((entry, i) => (
                <TimelineRow
                  key={entry.entityId}
                  entry={entry}
                  systemId={systemId}
                  position={i + 1}
                  isFirst={i === 0}
                  isLast={i === placed.length - 1}
                  busy={reorder.isPending}
                  onMove={(delta) => move(entry.entityId, delta)}
                  onUnplace={() => unplace.mutate(entry.entityId)}
                  onOpen={() => setOpenEntityId(entry.entityId)}
                />
              ))}
            </ol>
          )}

          {unplaced.length > 0 && (
            <section className="space-y-2">
              <SectionHead as="h3" title="Sin ubicar en el tiempo" count={unplaced.length} />
              <ul>
                {unplaced.map((entry) => (
                  <li
                    key={entry.entityId}
                    className="grid min-h-[3.4rem] grid-cols-[var(--margen)_1fr_auto] items-center border-b border-border last:border-b-0"
                  >
                    <Hourglass aria-hidden className="size-5 justify-self-center text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setOpenEntityId(entry.entityId)}
                      // El antes invisible lleva el toque a 48 px, como en las
                      // filas ubicadas, sin mover el nombre.
                      className="relative min-w-0 rounded-md py-1 text-left text-base font-semibold text-foreground focus-ring hover:underline before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']"
                    >
                      <span className="block truncate">{entry.name}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 gap-1.5 text-muted-foreground"
                      disabled={reorder.isPending}
                      onClick={() => place(entry)}
                    >
                      <CornerDownLeft aria-hidden className="size-4" />
                      Ubicar
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
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

function Empty({ title, hint }: { title: string; hint: string }) {
  return <EmptyState title={title} description={hint} />;
}

/**
 * Un evento ubicado: su puesto en el tiempo de la historia como numeral en el
 * margen, el nombre que abre su ficha, cuándo pasa, y en qué capítulos se
 * cuenta. «Se cuenta antes de tiempo» es una palabra de estado y va en coral.
 * Subir, bajar y sacar se ven en un dedo y aparecen al pasar en escritorio.
 */
function TimelineRow({
  entry,
  systemId,
  position,
  isFirst,
  isLast,
  busy,
  onMove,
  onUnplace,
  onOpen,
}: {
  entry: TimelineEntry;
  systemId: string;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onMove: (delta: number) => void;
  onUnplace: () => void;
  onOpen: () => void;
}) {
  return (
    <li className="group grid grid-cols-[var(--margen)_1fr] items-start border-b border-border py-2 last:border-b-0">
      <span className="flex h-[2.15rem] items-center justify-center font-display text-base font-bold text-muted-foreground tabular-nums">
        {position}
      </span>

      <div className="min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpen}
              // El nombre mide una línea; el antes invisible alarga el toque a
              // 48 px sin mover el texto ni el numeral del margen.
              className="relative block max-w-full rounded-md py-1 text-left text-base font-semibold text-foreground focus-ring hover:underline before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']"
            >
              <span className="block truncate">{entry.name}</span>
            </button>
            <p className="text-sm text-muted-foreground">
              {entry.when ?? "sin fecha en la historia"}
              {entry.outOfOrder && (
                <>
                  {", "}
                  <span className="inline-flex items-center gap-1 text-warn">
                    <Rewind aria-hidden className="size-3.5" />
                    se cuenta antes de tiempo
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="-mr-2 flex shrink-0 items-center transition-opacity duration-(--dur-toque) ease-(--ease-pluma) md:pointer-fine:opacity-0 md:pointer-fine:group-hover:opacity-100 md:pointer-fine:focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="md:pointer-fine:size-9"
              disabled={isFirst || busy}
              onClick={() => onMove(-1)}
              aria-label={`Mover «${entry.name}» antes en el tiempo`}
            >
              <ChevronUp className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:pointer-fine:size-9"
              disabled={isLast || busy}
              onClick={() => onMove(1)}
              aria-label={`Mover «${entry.name}» después en el tiempo`}
            >
              <ChevronDown className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground md:pointer-fine:size-9"
              disabled={busy}
              onClick={onUnplace}
              aria-label={`Sacar «${entry.name}» de la cronología`}
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        {(entry.what ?? entry.summary) && (
          <p className="line-clamp-2 text-sm text-body">{entry.what ?? entry.summary}</p>
        )}

        {entry.narratedIn.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no se cuenta en esta obra.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3">
            {entry.narratedIn.map((n) => (
              <Link
                key={n.pageId}
                href={`/systems/${systemId}/pages/${n.pageId}`}
                className="inline-flex min-h-9 items-center rounded-md text-sm text-muted-foreground underline-offset-2 focus-ring hover:text-foreground hover:underline pointer-coarse:min-h-[2.85rem]"
              >
                Capítulo {n.index}
                {n.title ? `: ${n.title}` : ""}
              </Link>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
