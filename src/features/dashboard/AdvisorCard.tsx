'use client';

import { useState } from 'react';
import { Lightbulb, Clock, Activity, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAdvisorAction } from '@/features/tasks/tasks.hooks';
import type { AdvisorPattern, PatternId } from '@/features/energy/energy.advisor';
import type { AdvisorBulkAction } from '@/features/energy/energy.types';

interface Props {
  pattern: AdvisorPattern | null;
  actionTaskIds: string[];
  actionLabel: string;
  bulkAction: AdvisorBulkAction;
}

const ICONS: Record<PatternId, React.FC<{ className?: string }>> = {
  overload: AlertTriangle,
  abandonment: Clock,
  disorganization: Lightbulb,
  underuse: Activity,
};

function severityColor(severity: number): string {
  if (severity >= 3) return 'text-task-overdue';
  if (severity >= 2) return 'text-primary';
  return 'text-muted-foreground';
}

function severityBg(severity: number): string {
  if (severity >= 3) return 'border-task-overdue/20 bg-task-overdue/10';
  if (severity >= 2) return 'border-primary/20 bg-primary';
  return 'border-border bg-card';
}

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
    <div className={cn('rounded-2xl border p-4 space-y-3 shadow-(--shadow)', severityBg(pattern.severity))}>
      <div className="flex items-start gap-3">
        <div className={cn('shrink-0 mt-0.5', severityColor(pattern.severity))}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className={cn('text-xs font-semibold uppercase tracking-wide', severityColor(pattern.severity))}>
            {pattern.label}
          </p>
          <p className="text-sm text-foreground">{pattern.message}</p>
        </div>
      </div>

      {hasAction && (
        <div className="flex items-center gap-2 pl-7">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={handleAction}
            disabled={isPending}
          >
            {isPending
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <ArrowRight className="w-3 h-3" />}
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
