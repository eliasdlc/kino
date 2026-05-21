import { Lightbulb, Clock, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdvisorPattern, PatternId } from '@/features/energy/energy.advisor';

interface Props {
  pattern: AdvisorPattern | null;
}

const ICONS: Record<PatternId, React.FC<{ className?: string }>> = {
  overload: AlertTriangle,
  abandonment: Clock,
  disorganization: Lightbulb,
  underuse: Activity,
};

function severityColor(severity: number): string {
  if (severity >= 3) return 'text-red-500 dark:text-red-400';
  if (severity >= 2) return 'text-amber-500 dark:text-amber-400';
  return 'text-muted-foreground';
}

function severityBg(severity: number): string {
  if (severity >= 3) return 'border-red-500/20 bg-red-500/5';
  if (severity >= 2) return 'border-amber-500/20 bg-amber-500/5';
  return 'border-border bg-card';
}

export function AdvisorCard({ pattern }: Props) {
  if (!pattern) return null;

  const Icon = ICONS[pattern.id];

  return (
    <div className={cn('rounded-xl border p-5 flex items-start gap-4', severityBg(pattern.severity))}>
      <div className={cn('shrink-0 mt-0.5', severityColor(pattern.severity))}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className={cn('text-xs font-semibold uppercase tracking-wide', severityColor(pattern.severity))}>
          {pattern.label}
        </p>
        <p className="text-sm text-foreground">{pattern.message}</p>
      </div>
    </div>
  );
}
