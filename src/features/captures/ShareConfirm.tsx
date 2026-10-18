"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarginRow } from "@/components/ui/margin-row";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { useSystems } from "@/features/systems/systems.hooks";
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
 * un control que no hace nada. Una que el agente leyó mal también se puede
 * descartar entera, sin desmarcar uno por uno.
 *
 * Cada item es una fila de margen: la marca en el margen, en tinta porque es
 * estado, y debajo del título a dónde va (el sistema que propuso el agente, o
 * Bandeja). El destino se lee aquí y se cambia después, en la tarea: elegirlo
 * en esta hoja pide que la confirmación lo acepte.
 */
export function ShareConfirm({ captura, open, onOpenChange, onConfirm, onDiscard }: ShareConfirmProps) {
  const propuestos = captura?.proposedItems ?? [];
  const { data: sistemas } = useSystems();
  const destinoDe = (systemId: string | undefined) =>
    (systemId && sistemas?.find((s) => s.id === systemId)?.name) || "Bandeja";
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
              : `${propuestos.length} ${propuestos.length === 1 ? "tarea propuesta" : "tareas propuestas"}`}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{captura ? tituloDe(captura) : ""}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {captura?.kind === "voice" && captura.blobPath && (
          <AudioWave src={captura.blobPath} segundos={captura.durationSeconds} className="pt-1" />
        )}

        {propuestos.length === 0 ? (
          <div className="space-y-3 pt-1">
            <p className="font-voice text-base italic leading-snug text-body">
              Pídele a tu agente que lea esta captura y las tareas caerán aquí con su destino. Mientras
              tanto sigue guardada: no se va a ir sin avisar.
            </p>
            <Button variant="secondary" size="lg" className="w-full" onClick={onDiscard}>
              Descartarla
            </Button>
          </div>
        ) : (
          <>
            <ul className="pt-1 [&>li:last-child>*]:border-b-0">
              {propuestos.map((item, indice) => {
                const marcado = !descartados.has(indice);
                return (
                  <li key={indice}>
                    <MarginRow
                      onClick={() => alternar(indice)}
                      aria-pressed={marcado}
                      className="last:border-b"
                      margin={
                        <span
                          aria-hidden
                          className={cn(
                            "mt-2 flex size-[1.35rem] items-center justify-center rounded-full border-[1.6px] transition-[background-color,border-color] duration-(--dur-toque) ease-(--ease-pluma)",
                            marcado ? "border-foreground bg-foreground text-background" : "border-input",
                          )}
                        >
                          {marcado && <Check className="size-3" strokeWidth={3} />}
                        </span>
                      }
                    >
                      <span
                        className={cn(
                          "block truncate font-medium transition-colors duration-(--dur-toque)",
                          marcado ? "text-foreground" : "text-muted-foreground line-through",
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        a {destinoDe(item.systemId)}
                        {item.notes && <>, {item.notes}</>}
                      </span>
                    </MarginRow>
                  </li>
                );
              })}
            </ul>
            <div className="space-y-2 pt-1">
              <Button size="lg" className="w-full text-base" disabled={marcados.length === 0} onClick={() => onConfirm(marcados)}>
                {marcados.length === 0 ? "No queda nada marcado" : `Confirmar ${marcados.length}`}
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={onDiscard}>
                Descartar la captura
              </Button>
            </div>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
