"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trash2, Plus, X, Loader2, ArrowRight } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  ENTITY_ATTRIBUTE_FIELDS,
  ENTITY_TYPES,
  type EntityType,
} from "./entities.attributes";
import {
  ENTITY_TYPE_ICON,
  ENTITY_TYPE_LABEL,
} from "./entities.ui";
import {
  useEntity,
  useUpdateEntity,
  useDeleteEntity,
  useSystemEntities,
  useCreateRelation,
  useDeleteRelation,
} from "./entities.hooks";
import { EntityImages } from "./EntityImages";

export function EntityFicheSheet({
  entityId,
  systemId,
  open,
  onOpenChange,
}: {
  entityId: string | null;
  systemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: entity, isLoading } = useEntity(open ? entityId : null);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Ficha del codex</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        {isLoading || !entity ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <EntityFicheForm
            key={entity.id}
            systemId={systemId}
            entity={entity}
            onClose={() => onOpenChange(false)}
          />
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function EntityFicheForm({
  systemId,
  entity,
  onClose,
}: {
  systemId: string;
  entity: import("./entities.types").EntityDetail;
  onClose: () => void;
}) {
  const [name, setName] = useState(entity.name);
  const [type, setType] = useState<EntityType>(entity.type);
  const [aliases, setAliases] = useState((entity.aliases ?? []).join(", "));
  const [summary, setSummary] = useState(entity.summary ?? "");
  // El form trabaja siempre con strings —es lo que devuelven los inputs— y el
  // Zod del manifiesto vuelve a coercionar los numéricos al guardar.
  const [attributes, setAttributes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(entity.attributes ?? {}).map(([k, v]) => [k, String(v)]),
    ),
  );

  const update = useUpdateEntity(entity.id, systemId);
  const remove = useDeleteEntity(systemId);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // El estado inicial viene del `entity` cargado; el form se remonta por
  // `key={entity.id}` en el padre, así que no hace falta re-sincronizar.
  const allFields = ENTITY_ATTRIBUTE_FIELDS[type] ?? [];
  // Los campos `hidden` los escribe otra pantalla (el orden in-world lo pone la
  // cronología reordenando), pero tienen que sobrevivir al guardado de la ficha.
  const fields = allFields.filter((f) => !f.hidden);

  function save() {
    const aliasList = aliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    // Solo mandamos attributes válidos para el tipo actual.
    const attrs: Record<string, string> = {};
    for (const f of allFields) {
      const v = attributes[f.id]?.trim();
      if (v) attrs[f.id] = v;
    }
    update.mutate({
      name: name.trim() || entity.name,
      type,
      aliases: aliasList,
      summary: summary.trim() || null,
      attributes: Object.keys(attrs).length ? attrs : null,
    });
  }

  const TypeIcon = ENTITY_TYPE_ICON[type];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
          <TypeIcon className="size-4.5 text-muted-foreground" />
        </span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="text-base font-semibold"
        />
      </div>

      <EntityImages entity={entity} systemId={systemId} />

      <div className="grid grid-cols-2 gap-3">
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
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Alias (coma)</Label>
          <Input
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="Apodo, otro nombre"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Resumen</Label>
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Una línea para el popover"
          rows={2}
        />
      </div>

      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              {f.input === "textarea" ? (
                <Textarea
                  value={attributes[f.id] ?? ""}
                  onChange={(e) =>
                    setAttributes((a) => ({ ...a, [f.id]: e.target.value }))
                  }
                  rows={2}
                />
              ) : (
                <Input
                  type={f.input === "number" ? "number" : "text"}
                  value={attributes[f.id] ?? ""}
                  onChange={(e) =>
                    setAttributes((a) => ({ ...a, [f.id]: e.target.value }))
                  }
                />
              )}
              {f.hint && (
                <p className="text-[11px] text-muted-foreground/80">{f.hint}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={update.isPending} className="gap-2">
          {update.isPending && <Loader2 className="size-3.5 animate-spin" />}
          Guardar
        </Button>
        {update.isSuccess && !update.isPending && (
          <span className="text-xs text-muted-foreground">Guardado</span>
        )}
      </div>

      <Separator />

      <RelationsSection systemId={systemId} entity={entity} />

      <Separator />

      <AppearancesSection systemId={systemId} entity={entity} />

      <Separator />

      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-destructive hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="size-3.5" />
        Eliminar del codex
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title={`¿Mover «${entity.name}» a la papelera?`}
        description="La entidad y sus relaciones se ocultan. Las menciones en el texto dejan de enlazar."
        confirmLabel="Mover a papelera"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          remove.mutate(entity.id, { onSuccess: onClose });
        }}
      />
    </div>
  );
}

function RelationsSection({
  systemId,
  entity,
}: {
  systemId: string;
  entity: import("./entities.types").EntityDetail;
}) {
  const { data: allEntities = [] } = useSystemEntities(systemId);
  const createRel = useCreateRelation(entity.id);
  const deleteRel = useDeleteRelation(entity.id);
  const [adding, setAdding] = useState(false);
  const [toId, setToId] = useState("");
  const [label, setLabel] = useState("");

  const options = useMemo(
    () => allEntities.filter((e) => e.id !== entity.id),
    [allEntities, entity.id],
  );

  function add() {
    if (!toId) return;
    createRel.mutate(
      { toEntityId: toId, label: label.trim() || null },
      {
        onSuccess: () => {
          setToId("");
          setLabel("");
          setAdding(false);
        },
      },
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Relaciones
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setAdding((a) => !a)}
        >
          <Plus className="size-3.5" />
          Añadir
        </Button>
      </div>

      {entity.relations.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">Sin relaciones todavía.</p>
      )}

      <ul className="space-y-1">
        {entity.relations.map((rel) => {
          const Icon = ENTITY_TYPE_ICON[rel.other.type];
          return (
            <li
              key={rel.id}
              className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 text-sm"
            >
              <span className="text-xs text-muted-foreground">
                {rel.outgoing ? rel.label ?? "relacionado con" : `← ${rel.label ?? "relacionado con"}`}
              </span>
              <ArrowRight className="size-3 shrink-0 text-muted-foreground/60" />
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{rel.other.name}</span>
              <button
                type="button"
                onClick={() => deleteRel.mutate(rel.id)}
                className="text-muted-foreground hover:text-destructive"
                title="Quitar relación"
              >
                <X className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>

      {adding && (
        <div className="space-y-2 rounded-md border border-border/60 p-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Etiqueta (rival de, vive en…)"
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger className="h-8 flex-1 text-sm">
                <SelectValue placeholder="¿Con quién?" />
              </SelectTrigger>
              <SelectContent>
                {options.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" onClick={add} disabled={!toId || createRel.isPending}>
              OK
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AppearancesSection({
  systemId,
  entity,
}: {
  systemId: string;
  entity: import("./entities.types").EntityDetail;
}) {
  if (entity.appearances.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Apariciones
        </p>
        <p className="text-xs text-muted-foreground">
          Aún no aparece en ningún capítulo. Menciónala con @ mientras escribes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Apariciones
      </p>
      <ul className="space-y-1">
        {entity.appearances.map((ap, i) => (
          <li key={ap.pageId}>
            <Link
              href={`/systems/${systemId}/pages/${ap.pageId}`}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/50",
              )}
            >
              <span className="min-w-0 flex-1 truncate">
                {ap.pageTitle || "Sin título"}
                {i === 0 && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">
                    1ª aparición
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {ap.mentionCount}×
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
