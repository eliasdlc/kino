"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarginRow } from "@/components/ui/margin-row";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Calendar } from "@/components/ui/calendar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { TaskTransport } from "./tasks.types";
import { closedByPhrase, formatDuration, hasDueTime, taskJsonFilename, withDay, withTime } from "./task-detail.helpers";
import { api } from "@convex/_generated/api";
import { useConvexQuery } from "@/shared/convex/hooks";
import { getConvexClient } from "@/shared/convex/client";

/**
 * Los renglones del detalle de una tarea. Cada dato es una fila de margen: su
 * rótulo vive en el margen, en versalitas de mute, y el valor en la columna de
 * texto, sin caja alrededor. Es la gramática de `MarginRow`: un renglón por
 * dato, separados por hairline, como en el mock de Diario (VENCE, ENERGÍA,
 * DURA, EN).
 */

/** El rótulo del margen: corto, en versalitas, alineado contra la columna de texto. */
function Rotulo({ id, htmlFor, children }: { id?: string; htmlFor?: string; children: React.ReactNode }) {
  const clase =
    "block text-right text-[0.62rem] leading-none font-semibold tracking-[0.07em] whitespace-nowrap text-muted-foreground uppercase";
  // El margen centra lo que lleva; el rótulo se pega a la columna de texto y,
  // si es más ancho que el margen, crece hacia la izquierda (el canto de la
  // hoja), nunca hacia el valor.
  return (
    <span className="flex w-full justify-end pt-[1.05rem] pr-2">
      {htmlFor ? (
        <label id={id} htmlFor={htmlFor} className={clase}>
          {children}
        </label>
      ) : (
        <span id={id} className={clase}>
          {children}
        </span>
      )}
    </span>
  );
}

/**
 * Un dato del detalle. `htmlFor` cuando el valor es un campo (el rótulo es su
 * `label`); `id` cuando el valor es un grupo que se nombra con `aria-labelledby`.
 */
export function DetailRow({
  label,
  htmlFor,
  id,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <MarginRow
      data-slot="detail-row"
      margin={
        <Rotulo id={id} htmlFor={htmlFor}>
          {label}
        </Rotulo>
      }
      className={cn("items-start", className)}
    >
      {children}
    </MarginRow>
  );
}

/** El valor de un dato que se toca para cambiarlo: 48 px con el dedo, sin borde de caja. */
export const VALOR_TOCABLE =
  "press focus-ring -ml-2 inline-flex min-h-[2.85rem] max-w-full items-center rounded-full px-2 text-left text-base transition-[background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) hover:bg-sf2/60 md:pointer-fine:min-h-9";

/** "18 oct 2026, 14:00", la fecha del detalle en español y sin punto medio. */
export function fechaDelDetalle(value: Date): string {
  const dia = format(value, "d MMM yyyy", { locale: es }).replace(".", "");
  return hasDueTime(value) ? `${dia}, ${format(value, "HH:mm")}` : dia;
}

/**
 * Lo que se abre al tocar un valor: en el teléfono una hoja (el pulgar no
 * apunta a un globo flotante sobre otra hoja), con ratón un globo junto al
 * valor.
 */
export function CampoFlotante({
  titulo,
  descripcion,
  open,
  onOpenChange,
  disparador,
  children,
}: {
  titulo: string;
  descripcion?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El botón que abre, ya con su texto; recibe `onClick` en el teléfono. */
  disparador: (props: { onClick?: () => void }) => React.ReactElement;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <>
        {disparador({ onClick: () => onOpenChange(true) })}
        <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>{titulo}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription className={cn(!descripcion && "sr-only")}>{descripcion ?? titulo}</ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            {children}
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{disparador({})}</PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function TimeLoggedSection({ taskId }: { taskId: string }) {
  const { data } = useConvexQuery(api.tasks.timeLogSummary, { id: taskId });

  if (!data || data.sessionCount === 0) return null;

  return (
    <DetailRow label="Tiempo">
      <p className="pt-[0.6rem] text-base">
        {formatDuration(data.totalMinutes)}
        <span className="text-muted-foreground">
          , en {data.sessionCount} sesión{data.sessionCount !== 1 ? "es" : ""}
        </span>
      </p>
    </DetailRow>
  );
}

/**
 * La firma del cierre: quién cerró la tarea, por qué vía y cuánto tiempo de
 * trabajo observado tiene. El tiempo sale de los time logs, que es la única
 * fuente de tiempo real del producto, y nunca de la estimación.
 *
 * Cuando falta un dato se dice con el mismo tamaño de letra que cuando lo hay:
 * una tarea cerrada sin firma y una sin tiempo registrado no se esconden en
 * gris pequeño.
 */
export function ClosingSignature({ task }: { task: TaskTransport }) {
  const { data } = useConvexQuery(api.tasks.timeLogSummary, task.completedAt ? { id: task.id } : "skip");

  if (!task.completedAt) return null;

  return (
    <DetailRow label="Cierre">
      <p className="pt-[0.6rem] text-base">
        {closedByPhrase(task.completedVia)},{" "}
        {data && data.totalMinutes > 0 ? `${formatDuration(data.totalMinutes)} de trabajo observado` : "sin tiempo observado"}
      </p>
    </DetailRow>
  );
}

/**
 * Una fecha del detalle (Empieza, Vence): el valor en español, y al tocarlo el
 * calendario con la hora y Limpiar. En el teléfono es una hoja con "Listo"
 * abajo; con ratón, un globo.
 */
export function DateTimeField({
  label,
  titulo,
  timeInputId,
  value,
  onChange,
}: {
  /** El rótulo corto del margen: "Vence". */
  label: string;
  /** El título de la hoja: "Fecha de vencimiento". */
  titulo: string;
  timeInputId: string;
  value: Date | undefined;
  onChange: (updater: (prev: Date | undefined) => Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const rotuloId = `${timeInputId}-rotulo`;
  return (
    <DetailRow label={label} id={rotuloId}>
      <CampoFlotante
        titulo={titulo}
        open={open}
        onOpenChange={setOpen}
        disparador={(props) => (
          <button type="button" aria-labelledby={rotuloId} aria-describedby={`${timeInputId}-valor`} className={VALOR_TOCABLE} {...props}>
            <span id={`${timeInputId}-valor`} className={cn("truncate", !value && "text-muted-foreground")}>
              {value ? fechaDelDetalle(value) : "Sin fecha"}
            </span>
          </button>
        )}
      >
        <div className="space-y-3">
          <Calendar mode="single" locale={es} selected={value} onSelect={(day) => onChange((prev) => withDay(prev, day))} className="mx-auto p-0" />
          {value && (
            <div className="flex items-center gap-3">
              <label htmlFor={timeInputId} className="shrink-0 text-sm text-muted-foreground">
                Hora
              </label>
              <Input
                id={timeInputId}
                type="time"
                value={hasDueTime(value) ? format(value, "HH:mm") : ""}
                onChange={(e) => onChange((prev) => withTime(prev, e.target.value || "00:00"))}
                className="h-[2.85rem] w-32 md:pointer-fine:h-9 dark:[color-scheme:dark]"
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={!value} onClick={() => onChange(() => undefined)}>
              Limpiar
            </Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>
              Listo
            </Button>
          </div>
        </div>
      </CampoFlotante>
    </DetailRow>
  );
}

/** Calificación de un evento académico ya completado (examen, quiz, práctica). Un renglón más, sin caja. */
export function GradeField({
  metadata,
  onChange,
}: {
  metadata: Record<string, unknown> | null;
  onChange: (next: Record<string, unknown> | null) => void;
}) {
  return (
    <DetailRow label="Nota" htmlFor="task-grade">
      <input
        id="task-grade"
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        value={(metadata?.grade as string | number) || ""}
        onChange={(e) => {
          const val = e.target.value;
          const newMetadata: Record<string, unknown> = { ...metadata };
          if (val === "") {
            delete newMetadata.grade;
          } else {
            newMetadata.grade = Number(val);
          }
          onChange(Object.keys(newMetadata).length ? newMetadata : null);
        }}
        placeholder="De 0 a 100"
        className="focus-ring min-h-[2.85rem] w-full rounded-md bg-transparent text-base tabular-nums outline-none placeholder:text-muted-foreground"
      />
    </DetailRow>
  );
}

/** Descarga la tarea y sus subtareas como JSON. */
export function ExportTaskJsonButton({ task }: { task: TaskTransport }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground"
      onClick={async () => {
        const subtasks = await getConvexClient().query(api.tasks.subtasks, { id: task.id }).catch(() => []);
        const payload = { ...task, subtasks };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = taskJsonFilename(task.title);
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download className="size-4" />
      Descargar en JSON
    </Button>
  );
}
