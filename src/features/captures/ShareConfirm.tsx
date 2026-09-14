"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { AudioWave } from "./AudioWave";
import { tituloDe } from "./captures.copy";
import type { CaptureItem } from "./captures.types";

interface ShareConfirmProps {
  captura: CaptureItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (indices: number[]) => void;
  onDiscard: () => void;
}

/**
 * El gesto que convierte lo compartido en items. Todo llega marcado porque el
 * caso normal es que el agente acertara; desmarcar el que no sirve cuesta un
 * toque y confirmar los tres cuesta otro.
 *
 * Una captura que el agente no entendió lo dice y ofrece la salida manual: sin
 * items propuestos no hay nada que confirmar, y fingir una lista vacía sería
 * un control que no hace nada.
 */
export function ShareConfirm({ captura, open, onOpenChange, onConfirm, onDiscard }: ShareConfirmProps) {
  const propuestos = captura?.proposedItems ?? [];
  const [descartados, setDescartados] = useState<Set<number>>(new Set());

  const marcados = propuestos.map((_, indice) => indice).filter((indice) => !descartados.has(indice));

  function alternar(indice: number) {
    setDescartados((previos) => {
      const siguiente = new Set(previos);
      if (siguiente.has(indice)) siguiente.delete(indice);
      else siguiente.add(indice);
      return siguiente;
    });
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDescartados(new Set());
        onOpenChange(next);
      }}
    >
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {propuestos.length === 0
              ? "Todavía nadie la ha leído"
              : `${propuestos.length} ${propuestos.length === 1 ? "item" : "items"}`}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{captura ? tituloDe(captura) : ""}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {captura?.kind === "voice" && captura.blobPath && (
          <AudioWave src={captura.blobPath} segundos={captura.durationSeconds} className="pt-1" />
        )}

        {propuestos.length === 0 ? (
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Pídele a tu agente que lea esta captura y los items caerán aquí con su destino. Mientras
              tanto sigue guardada: no se va a ir sin avisar.
            </p>
            <Button variant="secondary" className="h-12 w-full rounded-full" onClick={onDiscard}>
              Descartarla
            </Button>
          </div>
        ) : (
          <>
            <ul className="pt-1">
              {propuestos.map((item, indice) => {
                const marcado = !descartados.has(indice);
                return (
                  <li key={indice} className="border-b border-border last:border-0">
                    <button
                      type="button"
                      onClick={() => alternar(indice)}
                      aria-pressed={marcado}
                      className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-sm border-2",
                          marcado ? "border-primary bg-primary text-primary-foreground" : "border-input",
                        )}
                      >
                        {marcado && <Check className="size-3 stroke-[3]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm", !marcado && "text-muted-foreground line-through")}>
                          {item.title}
                        </span>
                        {item.notes && (
                          <span className="block truncate text-xs text-muted-foreground">{item.notes}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button
              className="h-12 w-full rounded-full text-base"
              disabled={marcados.length === 0}
              onClick={() => onConfirm(marcados)}
            >
              {marcados.length === 0 ? "No queda nada marcado" : `Confirmar ${marcados.length}`}
            </Button>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
