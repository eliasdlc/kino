'use client';

import { Battery, BatteryWarning } from 'lucide-react';
import { useEnergyBudget } from './energy.hooks';
import type { EnergyBudgetState } from './energy.budget';

interface EnergyBudgetBarProps {
  className?: string;
}

const TONES: Record<EnergyBudgetState, { spent: string; pending: string; text: string }> = {
  ok: { spent: 'bg-emerald-500', pending: 'bg-emerald-500/35', text: 'text-muted-foreground' },
  tight: { spent: 'bg-amber-500', pending: 'bg-amber-500/35', text: 'text-amber-600 dark:text-amber-400' },
  over: { spent: 'bg-red-500', pending: 'bg-red-500/35', text: 'text-red-500 dark:text-red-400' },
};

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
 * al instante. Informa siempre; no bloquea nunca.
 */
export function EnergyBudgetBar({ className }: EnergyBudgetBarProps) {
  const budget = useEnergyBudget();
  if (!budget) return null;

  const tone = TONES[budget.state];

  const fillPct = Math.min(100, budget.pct);
  const spentWidth = Math.min(budget.spentPct, fillPct);
  const pendingWidth = Math.max(0, fillPct - spentWidth);

  const Icon = budget.state === 'over' ? BatteryWarning : Battery;

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={`size-3.5 shrink-0 ${budget.state === 'ok' ? 'text-muted-foreground' : tone.text}`} />
          <span className="text-xs font-medium truncate">Energía comprometida</span>
        </div>
        <span
          className="font-mono text-xs tabular-nums text-muted-foreground shrink-0"
          title="Puntos por tarea: alta 5 · media 3 · baja 1"
        >
          {budget.committed}/{budget.limit}
        </span>
      </div>

      <div
        className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={budget.committed}
        aria-valuemin={0}
        aria-valuemax={budget.limit}
        aria-label="Energía comprometida hoy"
      >
        <div
          className={`h-full transition-[width] duration-300 ease-out ${tone.spent}`}
          style={{ width: `${spentWidth}%` }}
        />
        <div
          className={`h-full transition-[width] duration-300 ease-out ${tone.pending}`}
          style={{ width: `${pendingWidth}%` }}
        />
      </div>

      <p className={`mt-1 text-[11px] ${tone.text}`}>
        {message(budget.state, budget.remaining, budget.overBy, budget.committed)}
        {budget.spent > 0 && budget.state !== 'over' && (
          <span className="text-muted-foreground"> {budget.spent} ya cumplidos.</span>
        )}
      </p>
    </div>
  );
}
