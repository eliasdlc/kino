"use client";

import { useState } from "react";
import { Check, ChevronDown, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useUpdateSystem } from "@/features/systems/systems.hooks";
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
 * servidor. Gestionar los ciclos vive detrás de este mismo control.
 */
export function CyclePicker({ system, initialPeriods }: CyclePickerProps) {
  const { periods, selectedId, selected } = useSelectedCycle(system.id, initialPeriods);
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
    const current = systemMetadataSchema.safeParse(system.metadata ?? {});
    const metadata = { ...(current.success ? current.data : {}), academic: { cycleStartMonths: startMonths } };
    updateSystem({ systemId: system.id, data: { metadata } });
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-semibold transition-colors",
            "text-primary hover:border-primary/60",
          )}
          aria-label={`Ciclo: ${label}`}
        >
          {label}
          <ChevronDown className="size-3.5 opacity-70" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-1.5">
          <div className="max-h-80 overflow-y-auto">
            {years.map((year) => (
              <div key={year} className="pb-1">
                <p className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {year}
                </p>
                {periods
                  .filter((period) => period.year === year)
                  .map((period) => (
                    <button
                      key={period._id}
                      type="button"
                      onClick={() => pick(period._id)}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-accent",
                        selectedId === period._id && "text-primary",
                      )}
                    >
                      <Check className={cn("size-4 shrink-0", selectedId === period._id ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0 flex-1 truncate font-medium">{period.name}</span>
                      {period.isCurrent && <span className="shrink-0 text-xs text-primary">actual</span>}
                      {period.isClosed && <span className="shrink-0 text-xs text-muted-foreground">cerrado</span>}
                    </button>
                  ))}
              </div>
            ))}
            <button
              type="button"
              onClick={() => pick(null)}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-accent",
                selectedId === null && "text-primary",
              )}
            >
              <Check className={cn("size-4 shrink-0", selectedId === null ? "opacity-100" : "opacity-0")} />
              <span className="font-medium">Sin ciclo</span>
            </button>
          </div>
          <div className="mt-1 border-t border-border pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setManaging(true);
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
            >
              <Settings2 className="size-4 shrink-0 text-muted-foreground" />
              Gestionar años y ciclos
            </button>
          </div>
        </PopoverContent>
      </Popover>

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
