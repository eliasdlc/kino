"use client";

import { FileText, ImageIcon, Link2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { estadoDe, tituloDe } from "./captures.copy";
import type { CaptureItem } from "./captures.types";

/** El glifo del tipo, en el hueco que la fila de Bandeja ya reservaba. */
const GLIFOS = {
  photo: ImageIcon,
  link: Link2,
  voice: Mic,
  text: FileText,
} as const;

interface CaptureRowProps {
  captura: CaptureItem;
  onOpen: (captura: CaptureItem) => void;
}

/**
 * Una captura sin confirmar, dentro de la misma lista que las tareas.
 *
 * Es la misma fila, con una barra de acento a la izquierda: Bandeja sigue
 * siendo una sola lista que se lee de arriba abajo, que es lo que la hace
 * servir para triajear. Lo que no lleva es casilla, porque una captura no se
 * completa: se confirma, y eso abre otra pantalla.
 */
export function CaptureRow({ captura, onOpen }: CaptureRowProps) {
  const Glifo = GLIFOS[captura.kind];
  const estado = estadoDe(captura);

  return (
    <li className="flex items-center gap-3 border-b border-border last:border-0">
      <span
        aria-hidden
        className={cn(
          "h-10 w-0.5 shrink-0 rounded-full",
          captura.status === "expired" ? "bg-muted-foreground/40" : "bg-primary",
        )}
      />
      <button
        type="button"
        onClick={() => onOpen(captura)}
        className="min-h-12 min-w-0 flex-1 py-2 text-left"
      >
        <span className="block truncate text-sm">{tituloDe(captura)}</span>
        {estado && <span className="block truncate text-xs text-muted-foreground">{estado}</span>}
      </button>
      <span className="grid size-6 shrink-0 place-items-center text-muted-foreground">
        <Glifo className="size-3.5 stroke-2" aria-label={captura.kind} />
      </span>
    </li>
  );
}
