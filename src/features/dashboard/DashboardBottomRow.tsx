'use client';

import { CheckCircle2 } from 'lucide-react';
import { WeeklyTrendsCard } from './WeeklyTrendsCard';
import { LearningInsightCard } from './LearningInsightCard';
import { useTodayPlanTasks } from '@/features/tasks/tasks.hooks';
import type { WeeklyTrend, LearningInsight } from '@/features/energy/energy.service';

interface Props {
  weeklyTrends: WeeklyTrend;
  insight: LearningInsight;
}

function BottomCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col min-h-0 md:flex-1 transition-[border-color,box-shadow] hover:border-foreground/15 hover:shadow-sm">
      <div className="px-3 py-1.5 border-b shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground">{title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

export function DashboardBottomRow({ weeklyTrends, insight }: Props) {
  const { data: planTasks = [] } = useTodayPlanTasks();
  const doneCount = planTasks.filter((t) => t.status === 'done').length;
  const totalToday = planTasks.length;

  return (
    <div className="flex flex-col md:flex-row gap-3 md:h-full md:min-h-0">
      {/* Stats — siempre visible */}
      <div className="rounded-xl border bg-card px-4 py-2.5 flex md:flex-col items-center md:items-start justify-center gap-2 md:gap-0 shrink-0 md:min-w-[120px]">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-sm font-semibold tabular-nums">
            {doneCount}
            <span className="text-muted-foreground font-normal">/{totalToday}</span>
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground md:mt-0.5">completadas hoy</p>
      </div>

      {/* Kino te conoce */}
      {insight.chronotype && (
        <BottomCard title="Kino te conoce">
          <LearningInsightCard insight={insight} />
        </BottomCard>
      )}

      {/* Últimos 7 días */}
      <BottomCard title="Últimos 7 días">
        <WeeklyTrendsCard trends={weeklyTrends} />
      </BottomCard>
    </div>
  );
}
