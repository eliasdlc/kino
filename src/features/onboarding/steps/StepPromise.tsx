'use client';

import { ArrowRight, CheckCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getArchetype, seedUnitNoun, type ArchetypeIdentity } from '../onboarding.archetypes';
import type { SeedUnitInput } from '../onboarding.schemas';
import { buildSeedPlan, type SeedTask } from '../onboarding.seed';

interface Props {
  identity: ArchetypeIdentity;
  systemName: string;
  units: SeedUnitInput[];
  onSubmit: () => void;
  onBack: () => void;
  isLoading: boolean;
}

const ENERGY_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const ENERGY_COLOR: Record<string, string> = {
  high: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  medium: 'bg-violet-500/20 text-violet-600 dark:text-violet-400',
  low: 'bg-sky-500/20 text-sky-600 dark:text-sky-400',
};

const PREVIEW_LIMIT = 4;

/**
 * El cierre ya no promete con un plan inventado: previsualiza las tareas que la
 * siembra va a crear de verdad. Lo que se ve aquí es exactamente lo que estará en
 * el dashboard al terminar.
 */
export function StepPromise({
  identity,
  systemName,
  units,
  onSubmit,
  onBack,
  isLoading,
}: Props) {
  const archetype = getArchetype(identity);
  const plan = buildSeedPlan(identity, systemName, units);
  // Orden del día: primero lo que arranca hoy (la única con fecha), después lo
  // que la persona nombró y al final el resto del arquetipo. Así la línea
  // destacada es la que de verdad va a estar en el plan al entrar.
  const ordered: SeedTask[] = [...plan.folders.flatMap((f) => f.tasks), ...plan.tasks];
  const preview: SeedTask[] = [
    ...ordered.filter((t) => t.startsToday),
    ...ordered.filter((t) => !t.startsToday),
  ].slice(0, PREVIEW_LIMIT);
  const folderCount = plan.folders.length;
  const noun = seedUnitNoun(archetype);

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto w-full">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Con esto arrancas</h2>
        <p className="text-muted-foreground">{archetype.promise}</p>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {systemName || 'Tu sistema'}
        </p>

        {preview.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Arrancas en blanco. Kino ordena lo primero que escribas.
          </p>
        ) : (
          preview.map((task, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                task.startsToday ? 'bg-primary/5 border border-primary/20' : ''
              }`}
            >
              {task.startsToday ? (
                <Zap className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <p
                className={`flex-1 min-w-0 text-sm font-medium truncate ${
                  task.startsToday ? 'text-primary' : ''
                }`}
              >
                {task.startsToday && (
                  <span className="mr-1.5 text-xs font-semibold uppercase tracking-wide">Hoy</span>
                )}
                {task.title}
              </p>
              {task.energyLevel && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ENERGY_COLOR[task.energyLevel]}`}
                >
                  {ENERGY_LABEL[task.energyLevel]}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {folderCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {folderCount === 1
            ? `Además queda creada tu ${noun.singular}.`
            : `Además quedan creadas tus ${folderCount} ${noun.plural}.`}
        </p>
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
        <span>A partir de mañana el plan se arma con tu energía real del día.</span>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} disabled={isLoading} className="flex-1">
          Atrás
        </Button>
        <Button onClick={onSubmit} disabled={isLoading} className="flex-1">
          {isLoading ? 'Creando tu sistema...' : 'Empezar a usar Kino'}
        </Button>
      </div>
    </div>
  );
}
