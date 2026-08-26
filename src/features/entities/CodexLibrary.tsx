"use client";

import { useMemo, useState } from "react";
import { Search, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  ENTITY_TYPE_ICON,
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
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el universo…"
            className="pl-8"
          />
        </div>
        <Button className="gap-2" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Nueva entidad
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando el universo…</p>
      ) : total === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">Tu universo está vacío</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Menciona personajes, lugares u objetos con @ mientras escribes, o crea uno aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {ENTITY_TYPES.map((type) => {
            const list = grouped.get(type);
            if (!list || list.length === 0) return null;
            const Icon = ENTITY_TYPE_ICON[type];
            return (
              <section key={type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">
                    {ENTITY_TYPE_LABEL_PLURAL[type]}
                  </h3>
                  <span className="text-xs text-muted-foreground">{list.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {list.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setOpenEntityId(e.id)}
                      className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
                    >
                      <span className="truncate text-sm font-medium">{e.name}</span>
                      {e.summary ? (
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {e.summary}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/70">
                          {ENTITY_TYPE_LABEL[type]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
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
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            Crear
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
