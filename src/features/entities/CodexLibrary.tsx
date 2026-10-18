"use client";

import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { MarginRow } from "@/components/ui/margin-row";
import { IndexHead } from "@/features/notebooks/IndexHead";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSystemEntities, useCreateEntity } from "./entities.hooks";
import { EntityFicheSheet } from "./EntityFicheSheet";
import {
  ENTITY_TYPES,
  type EntityType,
} from "./entities.attributes";
import {
  ENTITY_TYPE_LABEL,
  ENTITY_TYPE_LABEL_PLURAL,
} from "./entities.ui";
import type { EntityListItemTransport } from "./entities.types";

/**
 * Biblioteca del universo (PLAN-11 §8.4): las entidades del sistema agrupadas por
 * tipo, con búsqueda. Se siente como el elenco de tu mundo. Cada ficha se abre en
 * un click.
 */
export function CodexLibrary({ systemId }: { systemId: string }) {
  const { data: entities = [], isLoading } = useSystemEntities(systemId);
  const [query, setQuery] = useState("");
  const [openEntityId, setOpenEntityId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const grouped = useMemo(() => {
    const q = query.toLowerCase().trim();
    const filtered = q
      ? entities.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            (e.aliases ?? []).some((a) => a.toLowerCase().includes(q)),
        )
      : entities;
    const byType = new Map<EntityType, EntityListItemTransport[]>();
    for (const e of filtered) {
      const list = byType.get(e.type) ?? [];
      list.push(e);
      byType.set(e.type, list);
    }
    return byType;
  }, [entities, query]);

  const total = entities.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search aria-hidden className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el universo"
            aria-label="Buscar en el universo"
            className="pl-8"
          />
        </div>
        <Button className="gap-2" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Nueva entidad
        </Button>
      </div>

      {isLoading ? (
        <p className="pl-(--margen) text-sm text-muted-foreground">Cargando el universo</p>
      ) : total === 0 ? (
        <EmptyState
          className="pl-(--margen)"
          title="Tu universo está vacío"
          description="Menciona personajes, lugares u objetos con @ mientras escribes, o crea uno aquí."
        />
      ) : (
        // Un índice por tipo, como el de las carpetas: el título de sección
        // con su cuenta y una fila por entidad con su numeral en el margen.
        // Sin cards: la fila es el contenedor.
        <div className="space-y-6">
          {ENTITY_TYPES.map((type) => {
            const list = grouped.get(type);
            if (!list || list.length === 0) return null;
            return (
              <section key={type} aria-labelledby={`codex-${type}`}>
                <IndexHead id={`codex-${type}`} as="h3" title={ENTITY_TYPE_LABEL_PLURAL[type]} trailing={list.length} />
                {list.map((e, i) => (
                  <MarginRow
                    key={e.id}
                    onClick={() => setOpenEntityId(e.id)}
                    margin={<span className="text-sm text-mute tabular-nums">{i + 1}</span>}
                  >
                    <span className="block truncate text-base font-semibold text-foreground">{e.name}</span>
                    <span className="line-clamp-2 block text-sm text-muted-foreground">
                      {e.summary || ENTITY_TYPE_LABEL[type]}
                    </span>
                  </MarginRow>
                ))}
              </section>
            );
          })}
        </div>
      )}

      <EntityFicheSheet
        entityId={openEntityId}
        systemId={systemId}
        open={openEntityId !== null}
        onOpenChange={(o) => !o && setOpenEntityId(null)}
      />

      <CreateEntityDialog
        systemId={systemId}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id) => {
          setCreating(false);
          setOpenEntityId(id);
        }}
      />
    </div>
  );
}

function CreateEntityDialog({
  systemId,
  open,
  onOpenChange,
  onCreated,
}: {
  systemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (entityId: string) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<EntityType>("character");
  const create = useCreateEntity(systemId);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(
      { name: trimmed, type },
      {
        onSuccess: (entity) => {
          setName("");
          setType("character");
          onCreated(entity.id);
        },
      },
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Nueva entidad</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nombre</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Kael, Puente Gris…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as EntityType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ENTITY_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full gap-2"
            onClick={submit}
            disabled={!name.trim() || create.isPending}
          >
            {create.isPending ? "Creando" : "Crear"}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
