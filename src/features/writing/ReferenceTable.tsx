"use client";

import Image from "next/image";
import { useState } from "react";
import { Pin, PinOff, Plus, X } from "lucide-react";
import { useSystemEntities } from "@/features/entities/entities.hooks";
import { ENTITY_TYPE_ICON } from "@/features/entities/entities.ui";
import { EntityFicheSheet } from "@/features/entities/EntityFicheSheet";
import type { EntityListItemTransport } from "@/features/entities/entities.types";

/**
 * Mesa de referencias (PLAN-11 §7): las fichas que el autor deja fijadas para
 * tenerlas delante mientras escribe — esencial en manga, donde la referencia
 * visual del personaje va junto al guion.
 */
export function ReferenceTable({
  systemId,
  pinnedIds,
  onToggle,
  canPin,
}: {
  systemId: string;
  pinnedIds: string[];
  onToggle: (entityId: string) => void;
  canPin: boolean;
}) {
  const { data: entities = [] } = useSystemEntities(systemId);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);

  const byId = new Map<string, EntityListItemTransport>(entities.map((e) => [e.id, e]));
  const pinned = pinnedIds
    .map((id) => byId.get(id))
    .filter((e): e is EntityListItemTransport => e !== undefined);

  const candidates = entities
    .filter((e) => !pinnedIds.includes(e.id))
    .filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Mesa de referencias
        </p>
        {canPin && (
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title="Fijar una referencia"
          >
            {picking ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          </button>
        )}
      </div>

      {!canPin && (
        <p className="text-xs text-muted-foreground">
          Los manuscritos sueltos no tienen mesa: pertenecen a ninguna obra.
        </p>
      )}

      {picking && (
        <div className="space-y-1 rounded-md border border-border p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el codex…"
            className="w-full rounded bg-muted/60 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary/40"
          />
          {candidates.length === 0 ? (
            <p className="px-1 py-1 text-xs text-muted-foreground">Sin resultados.</p>
          ) : (
            candidates.map((e) => {
              const Icon = ENTITY_TYPE_ICON[e.type];
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    onToggle(e.id);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors hover:bg-accent/50"
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <Pin className="size-3 shrink-0 text-muted-foreground" />
                </button>
              );
            })
          )}
        </div>
      )}

      {canPin && pinned.length === 0 && !picking && (
        <p className="text-xs text-muted-foreground">
          Fija personajes o lugares para tenerlos a la vista mientras escribes.
        </p>
      )}

      {pinned.length > 0 && (
        <ul className="grid grid-cols-3 gap-1.5">
          {pinned.map((e) => {
            const Icon = ENTITY_TYPE_ICON[e.type];
            return (
              <li key={e.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setOpenEntityId(e.id)}
                  className="block w-full overflow-hidden rounded-md border border-border bg-muted/40 text-left transition-colors hover:border-primary/40"
                  title={e.name}
                >
                  <span className="relative flex aspect-square items-center justify-center bg-muted">
                    {e.coverImageUrl ? (
                      // `unoptimized` como en las fichas del codex (W2): las
                      // portadas viven en Vercel Blob, fuera de remotePatterns.
                      <Image
                        src={e.coverImageUrl}
                        alt={e.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <Icon className="size-4 text-muted-foreground" />
                    )}
                  </span>
                  <span className="block truncate px-1 py-0.5 text-[10px] text-muted-foreground">
                    {e.name}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(e.id)}
                  aria-label={`Quitar ${e.name} de la mesa`}
                  className="absolute right-0.5 top-0.5 rounded bg-background/80 p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100 md:opacity-0"
                >
                  <PinOff className="size-3" />
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
