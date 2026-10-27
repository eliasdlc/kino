"use client";

import Image from "next/image";
import { useState } from "react";
import { Pin, PinOff, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MarginRow } from "@/components/ui/margin-row";
import { useSystemEntities } from "@/features/entities/entities.hooks";
import { ENTITY_TYPE_ICON, ENTITY_TYPE_LABEL } from "@/features/entities/entities.ui";
import { EntityFicheSheet } from "@/features/entities/EntityFicheSheet";
import type { EntityListItemTransport } from "@/features/entities/entities.types";
import { SectionHead } from "@/features/dashboard/SectionHead";
import { UNA_LINEA } from "@/shared/components/una-linea";

/**
 * Mesa de referencias (PLAN-11 §7): las fichas que el autor deja fijadas para
 * tenerlas delante mientras escribe: esencial en manga, donde la referencia
 * visual del personaje va junto al guion.
 *
 * Filas de margen de Diario: la portada (o el icono del tipo) en el margen, el
 * nombre que abre la ficha y Quitar en la cola. Quitar se ve siempre en un
 * dedo; sólo con ratón espera al hover. Fijar es una fila más al final, y su
 * búsqueda abre filas del mismo tamaño: nada aquí baja de 48 px.
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
      <SectionHead as="h3" title="Mesa de referencias" />

      {!canPin && (
        <p className="text-sm text-muted-foreground">
          Los manuscritos sueltos no tienen mesa: pertenecen a ninguna obra.
        </p>
      )}

      {canPin && pinned.length === 0 && !picking && (
        <p className="text-sm text-muted-foreground">
          Fija personajes o lugares para tenerlos a la vista mientras escribes.
        </p>
      )}

      {(pinned.length > 0 || canPin) && (
        <div>
          {pinned.map((e) => (
            <MarginRow
              key={e.id}
              data-slot="reference"
              className={`group ${UNA_LINEA}`}
              margin={<Portada entity={e} />}
              trailing={
                <button
                  type="button"
                  onClick={() => onToggle(e.id)}
                  aria-label={`Quitar ${e.name} de la mesa`}
                  title="Quitar de la mesa"
                  className="press -mr-2 flex size-[2.85rem] items-center justify-center rounded-full text-muted-foreground transition-[color,opacity,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:text-foreground md:pointer-fine:opacity-0 md:pointer-fine:group-hover:opacity-100 md:pointer-fine:focus-visible:opacity-100"
                >
                  <PinOff aria-hidden className="size-4" />
                </button>
              }
            >
              <button
                type="button"
                onClick={() => setOpenEntityId(e.id)}
                className="flex min-h-[2.85rem] w-full min-w-0 flex-col justify-center rounded-md text-left focus-ring"
              >
                <span className="block truncate text-base font-semibold text-foreground">{e.name}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {ENTITY_TYPE_LABEL[e.type].toLowerCase()}
                </span>
              </button>
            </MarginRow>
          ))}

          {canPin && (
            <MarginRow
              className={UNA_LINEA}
              margin={picking ? <X aria-hidden className="size-5" /> : <Plus aria-hidden className="size-5" />}
              onClick={() => {
                setPicking((p) => !p);
                setQuery("");
              }}
              aria-expanded={picking}
            >
              <span className="block text-base font-medium text-foreground">
                {picking ? "Dejar de buscar" : "Fijar una referencia"}
              </span>
            </MarginRow>
          )}
        </div>
      )}

      {picking && (
        <div className="space-y-1 pl-(--margen) pt-1">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el codex…"
            aria-label="Buscar en el codex"
          />
          {candidates.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Sin resultados.</p>
          ) : (
            <ul aria-label="Fichas para fijar" className="-ml-(--margen)">
              {candidates.map((e) => {
                const Icon = ENTITY_TYPE_ICON[e.type];
                return (
                  <li key={e.id}>
                    <MarginRow
                      className={UNA_LINEA}
                      margin={<Icon aria-hidden className="size-5" />}
                      trailing={<Pin aria-hidden className="size-4" />}
                      onClick={() => {
                        onToggle(e.id);
                        setQuery("");
                      }}
                      aria-label={`Fijar ${e.name}`}
                    >
                      <span className="block truncate text-base text-foreground">{e.name}</span>
                    </MarginRow>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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

/** La portada en un círculo del margen; sin portada, el icono de su tipo. */
function Portada({ entity }: { entity: EntityListItemTransport }) {
  const Icon = ENTITY_TYPE_ICON[entity.type];
  if (!entity.coverImageUrl) return <Icon aria-hidden className="size-5" />;
  return (
    <span className="relative block size-9 overflow-hidden rounded-full border border-border bg-secondary">
      {/* `unoptimized` como en las fichas del codex (W2): las portadas viven en
          Vercel Blob, fuera de remotePatterns. */}
      <Image src={entity.coverImageUrl} alt="" fill sizes="36px" className="object-cover" unoptimized />
    </span>
  );
}
