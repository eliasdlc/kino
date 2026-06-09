'use client';

import { useState } from 'react';
import { ChevronDown, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WeeklyTrendsCard } from './WeeklyTrendsCard';
import { LearningInsightCard } from './LearningInsightCard';
import { useTodayPlanTasks } from '@/features/tasks/tasks.hooks';
import type { WeeklyTrend } from '@/features/energy/energy.service';
import type { Chronotype } from '@/features/energy/energy.utils';

interface Props {
  weeklyTrends: WeeklyTrend;
  learnedCurve: number[] | null;
  learningAlpha: number;
  chronotype: Chronotype | null;
}

function CollapsePanel({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col min-h-0 flex-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors shrink-0"
      >
        <span className="text-xs font-semibold">{title}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div className="overflow-y-auto min-h-0 flex-1 border-t">{children}</div>
      )}
    </div>
  );
}

export function DashboardBottomRow({
  weeklyTrends,
  learnedCurve,
  learningAlpha,
  chronotype,
}: Props) {
  const { data: planTasks = [] } = useTodayPlanTasks();
  const doneCount = planTasks.filter((t) => t.status === 'done').length;
  const totalToday = planTasks.length;
  const hasPendingTasks = planTasks.some((t) => t.status !== 'done');
  const defaultOpen = !hasPendingTasks;

  return (
    <div className="flex gap-3 h-full min-h-0">
      {/* Stats — always visible */}
      <div className="rounded-xl border bg-card px-4 py-3 flex flex-col justify-center shrink-0 min-w-[120px]">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-sm font-semibold tabular-nums">
            {doneCount}
            <span className="text-muted-foreground font-normal">/{totalToday}</span>
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">completadas hoy</p>
      </div>

      {/* Kino te conoce */}
      {learnedCurve && learnedCurve.length === 24 && (
        <CollapsePanel title="Kino te conoce" defaultOpen={defaultOpen}>
          <LearningInsightCard
            learnedCurve={learnedCurve}
            learningAlpha={learningAlpha}
            chronotype={chronotype}
          />
        </CollapsePanel>
      )}

      {/* Últimos 7 días */}
      <CollapsePanel title="Últimos 7 días" defaultOpen={defaultOpen}>
        <WeeklyTrendsCard trends={weeklyTrends} />
      </CollapsePanel>
    </div>
  );
}
