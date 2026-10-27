"use client";

import { useState } from "react";
import { Check, ChevronDown, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useLiveSystem, useUpdateSystem } from "@/features/systems/systems.hooks";
import type { SystemTransport } from "@/features/systems/systems.types";
import { systemMetadataSchema } from "@/features/systems/systems.schemas";
import { chooseCycle, useSelectedCycle, type AcademicPeriod } from "./academic.hooks";
import { CycleManagerDialog } from "./CycleManagerDialog";

interface CyclePickerProps {
  system: SystemTransport;
  initialPeriods?: AcademicPeriod[];
}

/**
 * Los meses de inicio que el sistema tenga guardados. Se leen por el schema y
 * no a mano: `metadata` es JSON libre en la base, y el schema es quien dice qué
 * forma tiene de verdad.
 */
function cadenceOf(system: SystemTransport): number[] | null {
  const parsed = systemMetadataSchema.safeParse(system.metadata ?? {});
  return parsed.success ? (parsed.data.academic?.cycleStartMonths ?? null) : null;
}

/**
 * El año y el ciclo, en una línea de la cabecera. Es un filtro, no una
 * pantalla: se cambia sin salir de donde estás y sin pedirle la página al
 * servidor. Gestionar los ciclos vive detrás de este mismo control. En el
 * teléfono la lista es una hoja inferior y no un popover de escritorio.
 *
 * El sistema llega renderizado en el servidor y no cambia al guardar; la
 * cadencia se lee de su versión viva para que marcarla se vea al momento.
 */
export function CyclePicker({ system: initialSystem, initialPeriods }: CyclePickerProps) {
  const system = useLiveSystem(initialSystem);
  const { periods, selectedId, selected } = useSelectedCycle(system.id, initialPeriods);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const { mutate: updateSystem } = useUpdateSystem();

  const years = [...new Set(periods.map((period) => period.year))];
  const label = selected ? selected.name : periods.length === 0 ? "Sin ciclos" : "Sin ciclo";

  function pick(periodId: string | null) {
    chooseCycle(periodId);
    setOpen(false);
  }

  function setCadence(startMonths: number[]) {
    // Sólo la clave que cambia: `systems.update` conserva las demás.
    updateSystem({ systemId: system.id, data: { metadata: { academic: { cycleStartMonths: startMonths } } } });
  }

  const OPCION =
    "flex min-h-[2.85rem] w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors duration-(--dur-toque) hover:bg-accent focus-ring";

  const lista = (
    <>
      <div className="max-h-80 overflow-y-auto">
        {years.map((year) => (
          <div key={year} className="pb-1">
            <p className="px-2.5 pt-2 pb-1 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{year}</p>
            {periods
              .filter((period) => period.year === year)
              .map((period) => (
                <button
                  key={period._id}
                  type="button"
                  aria-pressed={selectedId === period._id}
                  onClick={() => pick(period._id)}
                  className={cn(OPCION, selectedId === period._id && "font-semibold text-foreground")}
                >
                  <Check aria-hidden className={cn("size-4 shrink-0", selectedId === period._id ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">{period.name}</span>
                  {period.isCurrent && <span className="shrink-0 text-xs text-muted-foreground">actual</span>}
                  {period.isClosed && <span className="shrink-0 text-xs text-muted-foreground">cerrado</span>}
                </button>
              ))}
          </div>
        ))}
        <button
          type="button"
          aria-pressed={selectedId === null}
          onClick={() => pick(null)}
          className={cn(OPCION, selectedId === null && "font-semibold text-foreground")}
        >
          <Check aria-hidden className={cn("size-4 shrink-0", selectedId === null ? "opacity-100" : "opacity-0")} />
          <span>Sin ciclo</span>
        </button>
      </div>
      <div className="mt-1 border-t border-border pt-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setManaging(true);
          }}
          className={cn(OPCION, "font-medium")}
        >
          <Settings2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          Gestionar años y ciclos
        </button>
      </div>
    </>
  );

  // El ciclo elegido es un estado: se dice en tinta, no en ámbar.
  const disparador =
    "inline-flex h-[2.85rem] max-w-full shrink-0 items-center gap-1.5 rounded-full border border-input px-4 text-sm font-semibold text-foreground transition-colors duration-(--dur-toque) hover:bg-muted focus-ring md:pointer-fine:h-9 md:pointer-fine:px-3";

  return (
    <>
      {isMobile ? (
        <>
          <button type="button" className={disparador} aria-label={`Ciclo: ${label}`} onClick={() => setOpen(true)}>
            <span className="min-w-0 truncate">{label}</span>
            <ChevronDown aria-hidden className="size-4 shrink-0 opacity-70" />
          </button>
          <ResponsiveDialog open={open} onOpenChange={setOpen}>
            <ResponsiveDialogContent>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>Año y ciclo</ResponsiveDialogTitle>
              </ResponsiveDialogHeader>
              {lista}
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            // `max-w` y `truncate`: un nombre de ciclo largo recorta el suyo en
            // vez de empujar al nombre del sistema fuera de su sitio.
            className={disparador}
            aria-label={`Ciclo: ${label}`}
          >
            <span className="min-w-0 truncate">{label}</span>
            <ChevronDown aria-hidden className="size-4 shrink-0 opacity-70" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-1.5">
            {lista}
          </PopoverContent>
        </Popover>
      )}

      <CycleManagerDialog
        systemId={system.id}
        periods={periods}
        cycleStartMonths={cadenceOf(system)}
        onCadenceChange={setCadence}
        open={managing}
        onOpenChange={setManaging}
      />
    </>
  );
}
