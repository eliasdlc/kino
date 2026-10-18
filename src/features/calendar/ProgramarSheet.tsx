"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarginRow } from "@/components/ui/margin-row";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import type { TaskTransport } from "@/features/tasks/tasks.types";
import { HOURS } from "./calendar.layout";

/** Lo que la hoja decide: el día entero o una hora en punto. */
export type Programacion = { hour: number | null };

interface ProgramarSheetProps {
  task: TaskTransport | null;
  /** El día al que va la tarea: el que se está mirando. */
  day: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La hora libre que mejor va con su energía, si la curva del día existe. */
  suggestedHour: number | null;
  onSchedule: (task: TaskTransport, programacion: Programacion) => void;
}

function hora(h: number): string {
  return `${h.toString().padStart(2, "0")}:00`;
}

/**
 * El equivalente con nombre del arrastre al calendario. En escritorio una
 * tarea sin fecha se suelta en un hueco; en el teléfono no se arrastra, se
 * programa: todo el día, la hora que su energía pide o una hora en punto. Las
 * dos rutas escriben lo mismo (`startDate` con hora, o `dueDate` del día).
 *
 * Cada opción mide 2.85rem y un toque decide y cierra: no hay confirmar,
 * porque la tarea queda a la vista en el día y cambiarla es otro toque.
 */
export function ProgramarSheet({ task, day, open, onOpenChange, suggestedHour, onSchedule }: ProgramarSheetProps) {
  function elegir(programacion: Programacion) {
    if (!task) return;
    onOpenChange(false);
    onSchedule(task, programacion);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Programar</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {task ? `${task.title}, el ${format(day, "EEEE d 'de' MMMM", { locale: es })}` : ""}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div>
          <MarginRow margin={<CalendarDays className="size-5" aria-hidden />} onClick={() => elegir({ hour: null })}>
            <span className="block font-semibold">Todo el día</span>
            <span className="block text-sm text-muted-foreground">Sin hora: entra en el día y no ocupa un hueco.</span>
          </MarginRow>
          {suggestedHour !== null && (
            <MarginRow
              margin={<Zap className="size-5" aria-hidden />}
              onClick={() => elegir({ hour: suggestedHour })}
              trailing={<span className="font-semibold text-foreground">{hora(suggestedHour)}</span>}
            >
              <span className="block font-semibold">A la hora que pide su energía</span>
              <span className="block text-sm text-muted-foreground">El hueco libre del día que mejor va con ella.</span>
            </MarginRow>
          )}
        </div>

        <fieldset className="space-y-2 pt-1">
          <legend className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            A una hora
          </legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {HOURS.map((h) => (
              <Button key={h} variant="secondary" className="tabular-nums" onClick={() => elegir({ hour: h })}>
                {hora(h)}
              </Button>
            ))}
          </div>
        </fieldset>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
