"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  Hourglass,
  Loader2,
  Rewind,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
        <p className="text-xs text-muted-foreground">
          Orden de la historia · el capítulo indica dónde se cuenta
        </p>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : placed.length === 0 && unplaced.length === 0 ? (
        <Empty
          title="No hay eventos en el codex"
          hint="Crea entidades de tipo Evento (un asedio, una coronación, la noche en que todo cambió) y ordénalas aquí en el tiempo de la historia."
        />
      ) : (
        <>
          {placed.length > 0 && (
            <ol className="relative space-y-2 border-l border-border pl-6">
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sin ubicar en el tiempo
              </h3>
              <ul className="space-y-2">
                {unplaced.map((entry) => (
                  <li
                    key={entry.entityId}
                    className="flex items-center gap-3 rounded-lg border border-dashed bg-card p-3"
                  >
                    <Hourglass className="size-4 shrink-0 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setOpenEntityId(entry.entityId)}
                      className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                    >
                      {entry.name}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 gap-1.5 text-muted-foreground"
                      disabled={reorder.isPending}
                      onClick={() => place(entry)}
                    >
                      <CornerDownLeft className="size-3.5" />
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
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <Hourglass className="mx-auto size-8 text-muted-foreground/40" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

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
    <li className="group relative rounded-lg border bg-card p-3">
      <span
        aria-hidden
        className={cn(
          "absolute -left-[27px] top-5 size-2.5 rounded-full border-2 border-background",
          entry.outOfOrder ? "bg-foreground" : "bg-muted-foreground/50",
        )}
      />

      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">
          {position}
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="truncate text-sm font-medium hover:underline"
            >
              {entry.name}
            </button>
            {entry.when && (
              <span className="text-xs text-muted-foreground">{entry.when}</span>
            )}
            {entry.outOfOrder && (
              <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">
                <Rewind className="size-3" />
                se cuenta antes de tiempo
              </span>
            )}
          </div>

          {(entry.what ?? entry.summary) && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {entry.what ?? entry.summary}
            </p>
          )}

          {entry.narratedIn.length === 0 ? (
            <p className="text-xs text-muted-foreground/70">
              Todavía no se cuenta en esta obra.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {entry.narratedIn.map((n) => (
                <Link
                  key={n.pageId}
                  href={`/systems/${systemId}/pages/${n.pageId}`}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Cap. {n.index}
                  {n.title ? ` · ${n.title}` : ""}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={isFirst || busy}
            onClick={() => onMove(-1)}
            aria-label={`Mover «${entry.name}» antes en el tiempo`}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={isLast || busy}
            onClick={() => onMove(1)}
            aria-label={`Mover «${entry.name}» después en el tiempo`}
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            disabled={busy}
            onClick={onUnplace}
            aria-label={`Sacar «${entry.name}» de la cronología`}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}
