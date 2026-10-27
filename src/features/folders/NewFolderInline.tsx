"use client";

import { useState } from "react";
import { useCreateFolder } from "./folders.hooks";
import type { ArchetypeFieldDef } from "@/shared/lib/system-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { NATIVE_SELECT_CLASS } from "@/features/notebooks/native-select";

interface NewFolderInlineProps {
  systemId: string;
  /** Texto del disparador y título de la hoja, p.ej. "Nueva obra". */
  label: string;
  placeholder: string;
  /** Campos del rol de carpeta (del manifiesto). Vacío, sólo nombre. */
  fields?: ArchetypeFieldDef[];
}

// `select` tiene su propio render e `idList` es siempre `hidden` (lo escribe la
// UI, no este formulario), así que ninguno necesita un tipo de input HTML.
const INPUT_TYPE: Record<Exclude<ArchetypeFieldDef["input"], "select" | "idList">, string> = {
  text: "text",
  date: "date",
  number: "number",
};

/**
 * Crear una carpeta con el vocabulario y los campos de su arquetipo. El
 * disparador es una acción con nombre en el título de su sección ("Nueva
 * obra"); el formulario es una hoja inferior en el teléfono y un diálogo en
 * escritorio, con campos de 2.85rem. Antes era un mini formulario en línea con
 * campos de 24 px, y es lo que crea las obras de escritura.
 */
export function NewFolderInline({ systemId, label, placeholder, fields: allFields = [] }: NewFolderInlineProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const { mutateAsync: createFolder, isPending } = useCreateFolder(systemId);

  // Los campos `hidden` del manifiesto los escribe la UI, no este formulario.
  const fields = allFields.filter((f) => !f.hidden);

  function reset() {
    setName("");
    setValues({});
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
    if (!trimmed) return;
    await createFolder({ name: trimmed, metadata: buildMetadata() });
    reset();
    setOpen(false);
  }

  return (
    <>
      <Button variant="link" size="sm" className="px-1" onClick={() => setOpen(true)}>
        {label}
      </Button>

      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{label}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <form
            className="flex flex-col gap-4 pt-1"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor={`nueva-carpeta-${systemId}`}>Nombre</Label>
              <Input
                id={`nueva-carpeta-${systemId}`}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={placeholder}
                maxLength={255}
              />
            </div>
            {fields.map((field) => {
              const id = `nueva-carpeta-${systemId}-${field.id}`;
              return (
                <div key={field.id} className="space-y-1.5">
                  <Label htmlFor={id}>{field.label}</Label>
                  {field.input === "select" ? (
                    <select
                      id={id}
                      value={values[field.id] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      className={NATIVE_SELECT_CLASS}
                    >
                      <option value="">Sin elegir</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={id}
                      type={INPUT_TYPE[field.input as keyof typeof INPUT_TYPE] ?? "text"}
                      inputMode={field.input === "number" ? "numeric" : undefined}
                      value={values[field.id] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })}
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? "Creando" : "Crear"}
            </Button>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
