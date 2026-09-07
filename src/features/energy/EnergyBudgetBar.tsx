'use client';

import { cn } from '@/lib/utils';
import { useEnergyBudget } from './energy.hooks';
import type { EnergyBudgetState } from './energy.budget';

interface EnergyBudgetBarProps {
  className?: string;
}

function message(
  state: EnergyBudgetState,
  remaining: number,
  overBy: number,
  committed: number,
): string {
  if (state === 'over') {
    return `Sobregiro de ${overBy} pt${overBy !== 1 ? 's' : ''}: nada te frena, pero el día ya está sobrevendido.`;
  }
  if (state === 'tight') {
    return remaining === 0 ? 'Presupuesto justo: el día está lleno.' : `Casi lleno: quedan ${remaining} pts.`;
  }
  // El día vacío se reconoce por lo comprometido, no por lo que queda: con un
  // límite válido, `remaining === 0` implica pct >= 100, que ya no es estado ok.
  if (committed === 0) return 'Sin energía comprometida todavía.';
  return `Quedan ${remaining} pt${remaining !== 1 ? 's' : ''} para hoy.`;
}

/**
 * Presupuesto de energía del día, visible (Fase 4.1 · D2).
 *
 * Se deriva del cache del plan de hoy más el límite de ajustes: hereda el patrón
 * optimista sin una petición extra, así que comprometer una tarea mueve la barra
 * al instante. Informa siempre; no bloquea nunca. El sobregiro se dice con la
 * palabra y el color de vencida; lo cumplido es acento lleno, lo pendiente
 * acento tenue.
 */
export function EnergyBudgetBar({ className }: EnergyBudgetBarProps) {
  const budget = useEnergyBudget();
  if (!budget) return null;

  const over = budget.state === 'over';
  const fillPct = Math.min(100, budget.pct);
  const spentWidth = Math.min(budget.spentPct, fillPct);
  const pendingWidth = Math.max(0, fillPct - spentWidth);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">Energía comprometida</span>
        <span className="shrink-0 tabular-nums" title="Puntos por tarea: alta 5 · media 3 · baja 1">
          {budget.committed} de {budget.limit}
        </span>
      </div>

      <div
        className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={budget.committed}
        aria-valuemin={0}
        aria-valuemax={budget.limit}
        aria-label="Energía comprometida hoy"
      >
        <div
          className={cn('h-full transition-[width] duration-300 ease-out', over ? 'bg-task-overdue' : 'bg-primary')}
          style={{ width: `${spentWidth}%` }}
        />
        <div
          className={cn('h-full transition-[width] duration-300 ease-out', over ? 'bg-task-overdue/40' : 'bg-primary/40')}
          style={{ width: `${pendingWidth}%` }}
        />
      </div>

      <p className={cn('mt-1 text-xs', over ? 'font-semibold text-task-overdue' : 'text-muted-foreground')}>
        {message(budget.state, budget.remaining, budget.overBy, budget.committed)}
        {budget.spent > 0 && !over && <span> {budget.spent} ya cumplidos.</span>}
      </p>
    </div>
  );
}
