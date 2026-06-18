'use client';

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
  useTodayPlanTasks();

  return (
    <div className="flex flex-col md:flex-row gap-3 md:h-full md:min-h-0">

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
