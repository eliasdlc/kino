"use client";

import { Check } from "lucide-react";
import { api } from "@convex/_generated/api";
import { toast } from "sonner";
import { useConvexMutation } from "@/shared/convex/hooks";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import type { AcademicPeriod } from "./academic.hooks";

interface MoveToCycleDialogProps {
  folder: { id: string; name: string; academicPeriodId?: string | null };
  periods: AcademicPeriod[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Mover una clase de ciclo. Es un diálogo y no un submenú a propósito: en el
 * teléfono no hay clic derecho ni hover, y un submenú ahí no se abre.
 *
 * El backend sólo acepta la materia raíz (`academicPeriods.assignSubject`), que
 * es la razón de que esto no se ofrezca sobre una subcarpeta.
 */
export function MoveToCycleDialog({ folder, periods, open, onOpenChange }: MoveToCycleDialogProps) {
  const assign = useConvexMutation(api.academicPeriods.assignSubject, {
    onError: () => toast.error("No se pudo mover la clase de ciclo"),
    onSuccess: () => onOpenChange(false),
  });
  const current = folder.academicPeriodId ?? null;
  const years = [...new Set(periods.map((period) => period.year))];

  function move(periodId: string | null) {
    if (periodId === current) {
      onOpenChange(false);
      return;
    }
    assign.mutate({ folderId: folder.id, periodId });
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[80vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Mover {folder.name} a un ciclo</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="pt-1">
          {years.map((year) => (
            <div key={year} className="pb-1">
              <p className="px-1 pb-1 pt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {year}
              </p>
              {periods
                .filter((period) => period.year === year)
                .map((period) => (
                  <button
                    key={period._id}
                    type="button"
                    disabled={assign.isPending}
                    onClick={() => move(period._id)}
                    className={cn(
                      "flex min-h-12 w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-60",
                      current === period._id && "text-primary",
                    )}
                  >
                    <Check className={cn("size-4 shrink-0", current === period._id ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1 truncate font-medium">{period.name}</span>
                    {period.isClosed && <span className="shrink-0 text-xs text-muted-foreground">cerrado</span>}
                  </button>
                ))}
            </div>
          ))}
          <button
            type="button"
            disabled={assign.isPending}
            onClick={() => move(null)}
            className={cn(
              "flex min-h-12 w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-60",
              current === null && "text-primary",
            )}
          >
            <Check className={cn("size-4 shrink-0", current === null ? "opacity-100" : "opacity-0")} />
            <span className="font-medium">Sin ciclo</span>
          </button>
          {periods.length === 0 && (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              Todavía no hay ciclos. Créalos desde el selector de la cabecera.
            </p>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
