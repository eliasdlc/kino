"use client";

import { FileText, ImageIcon, Link2, Mail, Mic, Paperclip } from "lucide-react";
import { MarginRow } from "@/components/ui/margin-row";
import { cn } from "@/lib/utils";
import { estadoDe, tituloDe } from "./captures.copy";
import type { CaptureItem } from "./captures.types";

/**
 * El glifo del tipo, en el margen de la fila. Lo que entra por una fuente
 * conectada se reconoce por su clase: un correo reenviado lleva el sobre y un
 * adjunto el clip. El nombre que se lee es la palabra en español, nunca el
 * nombre interno del tipo.
 */
const GLIFOS = {
  photo: { Icono: ImageIcon, nombre: "foto" },
  link: { Icono: Link2, nombre: "enlace" },
  voice: { Icono: Mic, nombre: "nota de voz" },
  text: { Icono: FileText, nombre: "texto" },
  email: { Icono: Mail, nombre: "correo" },
  file: { Icono: Paperclip, nombre: "archivo" },
} as const;

interface CaptureRowProps {
  captura: CaptureItem;
  onOpen: (captura: CaptureItem) => void;
}

/**
 * Una captura sin confirmar, dentro de la misma lista que las tareas: una
 * fila de margen con el glifo de su tipo en el margen y una barra de acento a
 * la izquierda, que es lo que la distingue de una tarea (DECISIONS:67). La
 * fila entera es el botón que la abre. Lo que no lleva es círculo de
 * completar, porque una captura no se completa: se confirma, y eso abre la
 * hoja. Caducada, la barra cae a mute y el estado lo dice en coral, con su
 * palabra delante.
 */
export function CaptureRow({ captura, onOpen }: CaptureRowProps) {
  const { Icono, nombre } = GLIFOS[captura.kind];
  const estado = estadoDe(captura);
  const caducada = captura.status === "expired";

  return (
    <li>
      <MarginRow
        onClick={() => onOpen(captura)}
        aria-label={`${nombre}: ${tituloDe(captura)}${estado ? `, ${estado}` : ""}`}
        className={cn(
          "relative last:border-b before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-full",
          caducada ? "before:bg-muted-foreground/40" : "before:bg-primary",
        )}
        margin={
          <span className="block pt-2.5">
            <Icono className="size-5" aria-label={nombre} />
          </span>
        }
      >
        <span className={cn("block truncate font-medium", caducada ? "text-muted-foreground" : "text-foreground")}>
          {tituloDe(captura)}
        </span>
        {estado && (
          <span className={cn("block truncate text-sm", caducada ? "font-semibold text-task-overdue" : "text-muted-foreground")}>
            {estado}
          </span>
        )}
      </MarginRow>
    </li>
  );
}
