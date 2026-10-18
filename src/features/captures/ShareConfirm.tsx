"use client";

import { useState } from "react";
import Link from "next/link";
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
import type { CaptureItem, ItemPropuesto } from "./captures.types";

/** A dónde fueron las tareas confirmadas, por sistema, para decirlo al cerrar. */
export interface DestinoConfirmado {
  /** El sistema, o nada si fue a Bandeja. */
  systemId: string | null;
  nombre: string;
  cuenta: number;
}

interface ShareConfirmProps {
  captura: CaptureItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (indices: number[], destinos: DestinoConfirmado[]) => void;
  onDiscard: () => void;
}

/**
 * El gesto que convierte lo compartido en items. Todo llega marcado porque el
 * caso normal es que el agente acertara; desmarcar el que no sirve cuesta un
 * toque y confirmar los tres cuesta otro.
 *
 * Una captura que el agente no ha leído lo dice, enlaza a cómo se conecta un
 * agente y ofrece dejarla donde está, que no destruye nada: descartarla es la
 * otra salida, y Bandeja la deja deshacer unos segundos. Una que el agente
 * leyó mal también se puede descartar entera, sin desmarcar uno por uno.
 *
 * Cada item es una fila de margen: la marca en el margen, en tinta porque es
 * estado, el título entero y debajo a dónde va (el sistema que propuso el
 * agente, o Bandeja). La lista se desplaza sola y Confirmar se queda a la
 * vista, también con muchas propuestas. El destino se lee aquí y se cambia
 * después, en la tarea: elegirlo en esta hoja pide que la confirmación lo
 * acepte.
 */
export function ShareConfirm({ captura, open, onOpenChange, onConfirm, onDiscard }: ShareConfirmProps) {
  const propuestos = captura?.proposedItems ?? [];
  const [descartados, setDescartados] = useState<Set<number>>(new Set());

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
            <Link
              href="/docs#mcp"
              className="focus-ring inline-flex min-h-[2.85rem] items-center rounded-sm text-sm font-semibold text-foreground underline decoration-input underline-offset-2 transition-[text-decoration-color] duration-(--dur-toque) ease-(--ease-pluma) hover:decoration-foreground"
            >
              Cómo conectar tu agente
            </Link>
            <div className="space-y-2">
              <Button variant="secondary" size="lg" className="w-full" onClick={() => onOpenChange(false)}>
                Dejarla aquí
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={onDiscard}>
                Descartarla
              </Button>
            </div>
          </div>
        ) : (
          <Propuestas
            propuestos={propuestos}
            descartados={descartados}
            onAlternar={(indice) =>
              setDescartados((previos) => {
                const siguiente = new Set(previos);
                if (siguiente.has(indice)) siguiente.delete(indice);
                else siguiente.add(indice);
                return siguiente;
              })
            }
            onConfirm={onConfirm}
            onDiscard={onDiscard}
          />
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/**
 * La lista de propuestas y sus dos salidas. Vive dentro del contenido de la
 * hoja, que sólo se monta abierta: así `useSystems` no se suscribe mientras
 * Bandeja tiene la hoja cerrada.
 */
function Propuestas({
  propuestos,
  descartados,
  onAlternar,
  onConfirm,
  onDiscard,
}: {
  propuestos: ItemPropuesto[];
  descartados: Set<number>;
  onAlternar: (indice: number) => void;
  onConfirm: (indices: number[], destinos: DestinoConfirmado[]) => void;
  onDiscard: () => void;
}) {
  const { data: sistemas } = useSystems();
  const sistemaDe = (systemId: string | undefined) => (systemId ? sistemas?.find((s) => s.id === systemId) : undefined);
  const destinoDe = (systemId: string | undefined) => sistemaDe(systemId)?.name || "Bandeja";
  const marcados = propuestos.map((_, indice) => indice).filter((indice) => !descartados.has(indice));

  function confirmar() {
    const destinos = new Map<string, DestinoConfirmado>();
    for (const indice of marcados) {
      const sistema = sistemaDe(propuestos[indice]?.systemId);
      const clave = sistema?.id ?? "bandeja";
      const previo = destinos.get(clave);
      if (previo) previo.cuenta += 1;
      else destinos.set(clave, { systemId: sistema?.id ?? null, nombre: sistema?.name ?? "Bandeja", cuenta: 1 });
    }
    onConfirm(marcados, [...destinos.values()]);
  }

  return (
    <>
      <ul className="max-h-[min(48dvh,24rem)] overflow-y-auto overscroll-contain pt-1 [&>li:last-child>*]:border-b-0">
        {propuestos.map((item, indice) => {
          const marcado = !descartados.has(indice);
          return (
            <li key={indice}>
              <MarginRow
                onClick={() => onAlternar(indice)}
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
                    "block font-medium leading-snug [overflow-wrap:anywhere] transition-colors duration-(--dur-toque) ease-(--ease-pluma)",
                    marcado ? "text-foreground" : "text-muted-foreground line-through",
                  )}
                >
                  {item.title}
                </span>
                <span className="block text-sm text-muted-foreground">
                  a {destinoDe(item.systemId)}
                  {item.notes && <>, {item.notes}</>}
                </span>
              </MarginRow>
            </li>
          );
        })}
      </ul>
      <div className="space-y-2 pt-1">
        <Button size="lg" className="w-full text-base" disabled={marcados.length === 0} onClick={confirmar}>
          {marcados.length === 0 ? "No queda nada marcado" : `Confirmar ${marcados.length}`}
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onDiscard}>
          Descartar la captura
        </Button>
      </div>
    </>
  );
}
