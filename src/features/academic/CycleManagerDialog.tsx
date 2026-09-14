"use client";

import { useState } from "react";
import { Check, Lock, LockOpen, Plus, Star } from "lucide-react";
import { api } from "@convex/_generated/api";
import { toast } from "sonner";
import { useConvexMutation } from "@/shared/convex/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { availableCycles, CYCLE_CADENCES, resolveCadence, type CycleCandidate } from "./academic-cycles";
import type { AcademicPeriod } from "./academic.hooks";

interface CycleManagerDialogProps {
  systemId: string;
  periods: AcademicPeriod[];
  /** Meses de inicio guardados en el sistema, si ya eligió cadencia. */
  cycleStartMonths: number[] | null;
  onCadenceChange: (startMonths: number[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Crear y mantener los ciclos, en un solo sitio. Un ciclo se elige de la lista
 * que genera la cadencia del sistema; escribir el nombre a mano queda como
 * salida de escape para un curso de verano o un calendario que no encaja.
 */
export function CycleManagerDialog({
  systemId,
  periods,
  cycleStartMonths,
  onCadenceChange,
  open,
  onOpenChange,
}: CycleManagerDialogProps) {
  const cadence = resolveCadence(cycleStartMonths);
  const candidates = availableCycles(cadence, periods);
  const [custom, setCustom] = useState(false);
  const [customYear, setCustomYear] = useState("");
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState("");

  const create = useConvexMutation(api.academicPeriods.create, {
    onError: (err) => setError(err.message || "No se pudo crear el ciclo"),
  });
  const update = useConvexMutation(api.academicPeriods.update, {
    onError: () => toast.error("No se pudo actualizar el ciclo"),
  });

  async function add(candidate: CycleCandidate) {
    setError("");
    await create.mutateAsync({ systemId, year: candidate.year, name: candidate.name });
  }

  async function addCustom(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    await create.mutateAsync({ systemId, year: customYear.trim(), name: customName.trim() });
    setCustomYear("");
    setCustomName("");
    setCustom(false);
  }

  const years = [...new Set(periods.map((period) => period.year))];

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[85vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Años y ciclos</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-6 pt-1">
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Cuántos ciclos tiene tu año
            </p>
            <div className="flex flex-wrap gap-2">
              {CYCLE_CADENCES.map((option) => {
                const active = option.startMonths.join() === cadence.startMonths.join();
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onCadenceChange(option.startMonths)}
                    aria-pressed={active}
                    className={cn(
                      "min-h-11 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Añadir un ciclo</p>
            {candidates.length === 0 && !custom && (
              <p className="text-sm text-muted-foreground">
                Ya tienes todos los ciclos de esta cadencia. Usa un nombre propio si hace falta otro.
              </p>
            )}
            <div className="grid gap-2">
              {candidates.slice(0, 6).map((candidate) => (
                <button
                  key={`${candidate.year}|${candidate.name}`}
                  type="button"
                  disabled={create.isPending}
                  onClick={() => add(candidate)}
                  className="flex min-h-12 items-center gap-2 rounded-xl border border-border px-3.5 text-left text-sm transition-colors hover:border-primary/60 disabled:opacity-60"
                >
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{candidate.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{candidate.year}</span>
                  {candidate.isCurrent && <span className="text-xs font-semibold text-primary">actual</span>}
                </button>
              ))}
            </div>
            {custom ? (
              <form onSubmit={addCustom} className="space-y-3 rounded-xl border border-border p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cycle-custom-year">Año académico</Label>
                  <Input
                    id="cycle-custom-year"
                    value={customYear}
                    onChange={(event) => setCustomYear(event.target.value)}
                    required
                    maxLength={40}
                    placeholder="2026-2027"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cycle-custom-name">Nombre del ciclo</Label>
                  <Input
                    id="cycle-custom-name"
                    value={customName}
                    onChange={(event) => setCustomName(event.target.value)}
                    required
                    maxLength={100}
                    placeholder="Verano de 2027"
                  />
                </div>
                <Button type="submit" disabled={!customYear.trim() || !customName.trim() || create.isPending}>
                  Crear ciclo
                </Button>
              </form>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setCustom(true)}>
                Otro nombre
              </Button>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </section>

          {periods.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tus ciclos</p>
              {years.map((year) => (
                <div key={year} className="space-y-1.5">
                  <p className="text-sm font-semibold">{year}</p>
                  {periods
                    .filter((period) => period.year === year)
                    .map((period) => (
                      <div key={period._id} className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                        <span className="text-sm">{period.name}</span>
                        {period.isCurrent && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                            <Check className="size-3" /> actual
                          </span>
                        )}
                        {period.isClosed && <span className="text-xs text-muted-foreground">cerrado</span>}
                        <div className="ml-auto flex items-center gap-1">
                          {!period.isCurrent && !period.isClosed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={update.isPending}
                              onClick={() => update.mutate({ id: period._id, isCurrent: true })}
                            >
                              <Star className="size-3.5" />
                              Marcar actual
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={update.isPending}
                            onClick={() => update.mutate({ id: period._id, isClosed: !period.isClosed })}
                          >
                            {period.isClosed ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
                            {period.isClosed ? "Reabrir" : "Cerrar"}
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </section>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
