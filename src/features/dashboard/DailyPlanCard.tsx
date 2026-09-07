import { Zap, ArrowRight, Clock, AlertCircle, Coffee } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { PlanItem, EnergyPlanItemTransport } from '@/features/energy/energy.planner';

interface Props {
  plan: PlanItem[];
  noProfile: boolean;
  energyItems?: EnergyPlanItemTransport[];
}

function estimatedLabel(estimatedTime: string | null | undefined): string {
  if (!estimatedTime) return '30 min';
  const parts = estimatedTime.split(':');
  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h`;
  return `${minutes} min`;
}

const ENERGY_PILL: Record<string, string> = {
  high: 'bg-primary/15 text-primary',
  medium: 'bg-secondary text-foreground',
  low: 'bg-secondary text-muted-foreground',
};

const ENERGY_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

function EnergyPlanRow({ item }: { item: EnergyPlanItemTransport }) {
  const { task, startsHere, breakBefore, effectiveEnergyAtStart } = item;
  return (
    <>
      {breakBefore && (
        <div className="flex items-center gap-2 px-5 py-2 bg-muted/30 text-xs text-muted-foreground">
          <Coffee className="w-3 h-3" />
          <span>Descanso recomendado</span>
        </div>
      )}
      <div
        className={cn(
          'flex items-center gap-3 px-5 py-3',
          startsHere && 'bg-primary/5',
        )}
      >
        <div className="shrink-0">
          {startsHere ? (
            <Zap className="w-4 h-4 text-primary" />
          ) : (
            <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {startsHere && (
            <p className="text-xs text-primary font-semibold mb-0.5">↗ Empieza aquí</p>
          )}
          <p className="text-sm font-medium truncate">{task.title}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              ENERGY_PILL[task.energyLevel] ?? ENERGY_PILL.medium,
            )}
          >
            {ENERGY_LABEL[task.energyLevel] ?? task.energyLevel}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground" title="Energía al inicio">
            {Math.round(effectiveEnergyAtStart)}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {estimatedLabel(task.estimatedTime)}
          </span>
        </div>
      </div>
    </>
  );
}

export function DailyPlanCard({ plan, noProfile, energyItems }: Props) {
  // Si hay plan consciente de energía, usarlo; si no, el plan de presupuesto.
  const useEnergyPlan = energyItems !== undefined && energyItems.length > 0;
  if (noProfile) {
    return (
      <div className="rounded-xl border bg-card p-5 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium text-sm">Plan de hoy no disponible</p>
          <p className="text-sm text-muted-foreground">
            Completa tu perfil de energía para que Kino pueda proponerte un plan.
          </p>
          <Link href="/onboarding" className="text-sm text-primary hover:underline">
            Configurar perfil →
          </Link>
        </div>
      </div>
    );
  }

  const isEmpty = useEnergyPlan ? energyItems!.length === 0 : plan.length === 0;

  if (isEmpty) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm font-medium mb-1">Plan de hoy</p>
        <p className="text-sm text-muted-foreground">
          No hay tareas programadas para hoy. Mueve algo de tu backlog a &ldquo;Hoy&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">Plan de hoy</p>
          <p className="text-xs text-muted-foreground">
            {useEnergyPlan
              ? `${energyItems!.length} tarea${energyItems!.length > 1 ? 's' : ''} ordenadas por energía`
              : `${plan.length} tarea${plan.length > 1 ? 's' : ''} ordenadas por importancia`}
          </p>
        </div>
      </div>

      <div className="divide-y">
        {useEnergyPlan
          ? energyItems!.map((item) => (
              <EnergyPlanRow key={item.task.id} item={item} />
            ))
          : plan.map(({ task, startsHere }) => (
              <div
                key={task.id}
                className={cn(
                  'flex items-center gap-3 px-5 py-3',
                  startsHere && 'bg-primary/5',
                )}
              >
                <div className="shrink-0">
                  {startsHere ? (
                    <Zap className="w-4 h-4 text-primary" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {startsHere && (
                    <p className="text-xs text-primary font-semibold mb-0.5">↗ Empieza aquí</p>
                  )}
                  <p className="text-sm font-medium truncate">{task.title}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      ENERGY_PILL[task.energyLevel] ?? ENERGY_PILL.medium,
                    )}
                  >
                    {ENERGY_LABEL[task.energyLevel] ?? task.energyLevel}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {estimatedLabel(task.estimatedTime)}
                  </span>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
