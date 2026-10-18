'use client';

import { WeeklyTrendsCard } from './WeeklyTrendsCard';
import { LearningInsightCard } from './LearningInsightCard';
import { CoachPanel } from '@/features/insights/CoachPanel';
import { useTodayPlanTasks } from '@/features/tasks/tasks.hooks';
import { SectionHead } from './SectionHead';
import type { WeeklyTrend, LearningInsight } from '@/features/energy/energy.types';

interface Props {
  weeklyTrends: WeeklyTrend;
  insight: LearningInsight;
}

/** Un bloque con su título y hairline. Sin tarjeta: el renglón separa. */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0">
      <SectionHead title={title} />
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * Lo aprendido de ti, debajo del plan: el coach, tu patrón y los últimos
 * siete días. Cada bloque es un título con hairline y su contenido; el que no
 * tiene datos lo dice en una línea.
 */
export function DashboardBottomRow({ weeklyTrends, insight }: Props) {
  useTodayPlanTasks();

  return (
    <div className="grid gap-8 pt-2 lg:grid-cols-2">
      <Block title="Coach">
        <CoachPanel />
      </Block>

      {insight.chronotype && (
        <Block title="Tu patrón">
          <LearningInsightCard insight={insight} />
        </Block>
      )}

      <Block title="Últimos 7 días">
        <WeeklyTrendsCard trends={weeklyTrends} />
      </Block>
    </div>
  );
}
