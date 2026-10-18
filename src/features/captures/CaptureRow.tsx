"use client";

import { FileText, ImageIcon, Link2, Mail, Mic, Paperclip } from "lucide-react";
import { MarginRow } from "@/components/ui/margin-row";
import { cn } from "@/lib/utils";
import { avisoDe, cuandoLlego, estadoDe, tituloDe } from "./captures.copy";
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
 * fila de margen con el glifo de su tipo en el margen, que es lo que la
 * distingue de una tarea (DECISIONS:67). La fila entera es el botón que la
 * abre. Lo que no lleva es círculo de completar, porque una captura no se
 * completa: se confirma, y eso abre la hoja.
 *
 * La meta dice qué espera en palabras, como "vencida" en una tarea: "sin
 * leer" o cuántas tareas propone, cuándo llegó, de qué fuente y si está por
 * caducar. Caducada, la palabra va en coral y el título cae a mute. Sin barra
 * de color: el estado es una palabra, no un adorno.
 */
export function CaptureRow({ captura, onOpen }: CaptureRowProps) {
  const { Icono, nombre } = GLIFOS[captura.kind];
  const caducada = captura.status === "expired";
  const estado = estadoDe(captura);
  const aviso = avisoDe(captura);
  const meta = [cuandoLlego(captura), captura.source ? `desde ${captura.source}` : null, aviso].filter(
    (parte): parte is string => parte !== null,
  );

  return (
    <li>
      <MarginRow
        onClick={() => onOpen(captura)}
        aria-label={`${nombre}: ${tituloDe(captura)}, ${[estado, ...meta].join(", ")}`}
        className="last:border-b"
        margin={
          <span className="block pt-2.5">
            <Icono className="size-5" aria-label={nombre} />
          </span>
        }
      >
        <span className={cn("line-clamp-2 block font-medium leading-snug [overflow-wrap:anywhere]", caducada ? "text-muted-foreground" : "text-foreground")}>
          {tituloDe(captura)}
        </span>
        <span className="block text-sm text-muted-foreground">
          <span className={cn("font-semibold", caducada ? "text-task-overdue" : "text-body")}>{estado}</span>
          {meta.map((parte) => (
            <span key={parte}>, {parte}</span>
          ))}
        </span>
      </MarginRow>
    </li>
  );
}
