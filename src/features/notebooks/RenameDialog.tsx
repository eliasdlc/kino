"use client";

import { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Renombrar obra", "Renombrar apunte": el sustantivo sale del manifiesto. */
  title: string;
  /** El nombre actual; el campo arranca con él cada vez que se abre. */
  current: string;
  /** "Nombre" para un contenedor, "Título" para un documento. */
  fieldLabel?: string;
  maxLength?: number;
  saving?: boolean;
  /** Recibe el nombre ya recortado. No se llama si no cambió. */
  onSave: (next: string) => void;
}

/**
 * Renombrar, la operación con nombre que antes vivía en cada tarjeta. En el
 * teléfono es la hoja inferior; mientras guarda, el botón dice que guarda en
 * vez de girar.
 */
export function RenameDialog({
  open,
  onOpenChange,
  title,
  current,
  fieldLabel = "Nombre",
  maxLength = 255,
  saving = false,
  onSave,
}: RenameDialogProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        {/* El formulario se monta al abrir, así el borrador nace del nombre actual. */}
        {open && (
          <RenameForm
            current={current}
            fieldLabel={fieldLabel}
            maxLength={maxLength}
            saving={saving}
            onSave={(next) => {
              if (next === current.trim()) onOpenChange(false);
              else onSave(next);
            }}
          />
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function RenameForm({
  current,
  fieldLabel,
  maxLength,
  saving,
  onSave,
}: {
  current: string;
  fieldLabel: string;
  maxLength: number;
  saving: boolean;
  onSave: (next: string) => void;
}) {
  const [value, setValue] = useState(current);
  const trimmed = value.trim();

  return (
    <form
      className="flex flex-col gap-4 pt-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onSave(trimmed);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="rename-field">{fieldLabel}</Label>
        <Input
          id="rename-field"
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={maxLength}
        />
      </div>
      <Button type="submit" disabled={!trimmed || saving}>
        {saving ? "Guardando" : "Guardar"}
      </Button>
    </form>
  );
}
