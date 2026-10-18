'use client';

import { useState } from 'react';
import { Lightbulb, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdvisorAction } from '@/features/tasks/tasks.hooks';
import { SectionHead } from './SectionHead';
import type { AdvisorPattern, PatternId } from '@/features/energy/energy.advisor';
import type { AdvisorBulkAction } from '@/features/energy/energy.types';

interface Props {
  pattern: AdvisorPattern | null;
  actionTaskIds: string[];
  actionLabel: string;
  bulkAction: AdvisorBulkAction;
}

const ICONS: Record<PatternId, React.FC<{ className?: string }>> = {
  abandonment: Clock,
  disorganization: Lightbulb,
};

/**
 * El patrón que queda, bajo el plan: un título con hairline, el glifo en el
 * margen, la frase en la columna de texto y una sola acción. La gravedad no
 * tiñe nada: la dice la frase, y el bloque se va cuando la acción se aplica.
 */
export function AdvisorCard({ pattern, actionTaskIds, actionLabel, bulkAction }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const { mutate: runAction, isPending } = useAdvisorAction();

  if (!pattern || dismissed) return null;

  const Icon = ICONS[pattern.id];
  const hasAction = bulkAction !== 'none' && actionTaskIds.length > 0;

  function handleAction() {
    runAction(
      { taskIds: actionTaskIds, bulkAction, actionLabel },
      { onSuccess: () => setDismissed(true) },
    );
  }

  return (
    <section aria-label={pattern.label}>
      <SectionHead title={pattern.label} />
      <div className="grid grid-cols-[var(--margen)_1fr] items-start pt-3">
        <span className="flex justify-center pt-0.5 text-muted-foreground" aria-hidden>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 space-y-3">
          <p className="text-sm text-body">{pattern.message}</p>
          {hasAction && (
            <Button variant="secondary" onClick={handleAction} disabled={isPending} aria-busy={isPending}>
              <ArrowRight className="size-4" />
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
