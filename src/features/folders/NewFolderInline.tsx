"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { Plus, Target, type LucideProps } from "lucide-react";
import { useCreateFolder } from "./folders.hooks";
import type { ArchetypeFieldDef } from "@/shared/lib/system-types";

interface NewFolderInlineProps {
  systemId: string;
  /** Texto del botón disparador, p.ej. "Nueva clase" / "Nuevo milestone". */
  label: string;
  placeholder: string;
  /** Icono mostrado junto al input. Por defecto Target. */
  icon?: ComponentType<LucideProps>;
  /** Campos del rol de carpeta (del manifiesto). Vacío → solo nombre. */
  fields?: ArchetypeFieldDef[];
}

const INPUT_TYPE: Record<ArchetypeFieldDef["input"], string> = {
  text: "text",
  date: "date",
  number: "number",
};

/**
 * Control inline para crear un folder con el vocabulario y los campos de su
 * arquetipo (manifiesto). Sin `fields` es el patrón simple de una línea; con
 * `fields` despliega un mini-form (clase con profesor/horario, milestone con
 * fecha objetivo…). La metadata se valida server-side por systemType.
 */
export function NewFolderInline({
  systemId,
  label,
  placeholder,
  icon: Icon = Target,
  fields = [],
}: NewFolderInlineProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: createFolder, isPending } = useCreateFolder(systemId);

  const hasFields = fields.length > 0;

  useEffect(() => {
    if (isCreating) inputRef.current?.focus();
  }, [isCreating]);

  function reset() {
    setName("");
    setValues({});
    setIsCreating(false);
  }

  function buildMetadata(): Record<string, string> | undefined {
    const meta: Record<string, string> = {};
    for (const field of fields) {
      const v = values[field.id]?.trim();
      if (v) meta[field.id] = v;
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      reset();
      return;
    }
    try {
      await createFolder({ name: trimmed, metadata: buildMetadata() });
    } finally {
      reset();
    }
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Con campos extra, Enter en el nombre pasa el foco al primer campo en vez
    // de crear a medias.
    if (e.key === "Enter" && !hasFields) handleCreate();
    if (e.key === "Escape") reset();
  }

  if (isCreating && hasFields) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-primary/50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Icon size={16} className="shrink-0 text-primary" />
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleNameKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="grid grid-cols-1 gap-1.5 pl-6 sm:grid-cols-2">
          {fields.map((field) => (
            <input
              key={field.id}
              type={INPUT_TYPE[field.input]}
              value={values[field.id] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") reset();
              }}
              placeholder={field.label}
              className="rounded border border-border/60 bg-transparent px-2 py-1 text-xs outline-none focus:border-primary/60 placeholder:text-muted-foreground/60"
            />
          ))}
        </div>
        <div className="flex items-center gap-2 pl-6">
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending || !name.trim()}
            className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Crear
          </button>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (isCreating) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-primary/50 px-3 py-2">
        <Icon size={16} className="shrink-0 text-primary" />
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleNameKeyDown}
          onBlur={() => {
            if (isPending) return;
            if (!name.trim()) setIsCreating(false);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsCreating(true)}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <Plus size={15} className="shrink-0" />
      {label}
    </button>
  );
}
